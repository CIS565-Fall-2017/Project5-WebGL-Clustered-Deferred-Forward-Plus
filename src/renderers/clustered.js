import { mat4, vec4, vec3 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';
import {camera} from "../init";

export const MAX_LIGHTS_PER_CLUSTER = 100;

const pos=vec3.create();
const light_pos4=vec4.create();

export default class ClusteredRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

      for (let z = 0; z < this._zSlices; ++z) {
          for (let y = 0; y < this._ySlices; ++y) {
              for (let x = 0; x < this._xSlices; ++x) {
                  let index = x + y * this._xSlices + z * this._xSlices * this._ySlices;
                  // Reset the light count to 0 for every cluster
                  this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)] = 0;}}}

      // WHY LOOP CLUSTERS?????

      //Get camera angles in X,Y axis
      let yFOV=camera.fov;
      let xFOV=camera.aspect*yFOV;
      //Get degrees for each segment
      let ysegment=yFOV*2.0/this._ySlices;
      let xsegment=xFOV*2.0/this._xSlices;

      let totallights=0;
      let lightnumtotalinscene=scene.lights.length;
      //Camera position
      let cam_pos=camera.position;
      //Get camera direction XY
      /*
      let cam_dir_x=vec3.create();
      let cam_q=vec4.create();
      cam_q[0]=camera.quaternion.w;
      cam_q[1]=camera.quaternion.x;
      cam_q[2]=0;
      cam_q[3]=0;
      vec3.transformQuat(cam_dir_x,vec3.fromValues(0,0,1),cam_q);

      let cam_dir_y=vec3.create();
      cam_q[0]=camera.quaternion.w;
      cam_q[1]=0;
      cam_q[2]=camera.quaternion.y;
      cam_q[3]=0;
      vec3.transformQuat(cam_dir_y,vec3.fromValues(0,0,1),cam_q);
      */
      let cam_dir_x=vec3.fromValues(0,0,1);
      //vec3.rotateY(cam_dir_x,cam_dir_x,vec3.create(),camera.rotation.y*180.0/Math.PI);

      let cam_dir_y=vec3.fromValues(0,0,1);
      //vec3.rotateX(cam_dir_y,cam_dir_y,vec3.create(),camera.rotation.x*180.0/Math.PI);



      //Loop Lights
      for(let L=0;L<lightnumtotalinscene;L++)
      {

          //Light Position
          vec3.set(pos,scene.lights[L].position[0], scene.lights[L].position[1], scene.lights[L].position[2]);
          //Light-Camera Distance
          let dis=vec3.create();
          dis[0]=pos[0]-cam_pos.x;
          dis[1]=pos[1]-cam_pos.y;
          dis[2]=pos[2]-cam_pos.z;
          //X,Y angles
          var dis2;
          dis2=dis;
          dis2[0]=0;
          let yangle=(vec3.angle(vec3.fromValues(0,0,1),dis2)-camera.rotation.y)*180/Math.PI;
          dis2[0]=dis[0];
          dis2[1]=0;
          let xangle=(vec3.angle(vec3.fromValues(0,0,1),dis2)-camera.rotation.x)*180/Math.PI;
          //which segment is it in?
          let xint=Math.round(xangle/xsegment);
          let yint=Math.round(yangle/ysegment);
          let zint=Math.round( dis[2] / ((camera.far-camera.near)/this._zSlices) );

          //Radius of Light
          let r=scene.lights[L].radius;
          //Get Bounding BOX
          let xmin=vec3.fromValues(dis[0]-r, dis[1], dis[2]);
          let xmax=vec3.fromValues(dis[0]+r, dis[1], dis[2]);
          let ymin=vec3.fromValues(dis[0], dis[1]-r, dis[2]);
          let ymax=vec3.fromValues(dis[0], dis[1]+r, dis[2]);
          let zmin=vec3.fromValues(dis[0], dis[1], dis[2]-r);
          let zmax=vec3.fromValues(dis[0], dis[1], dis[2]+r);
          //Rotate Camera direction to left most
          let direction=vec3.fromValues(0,0,1);
          vec3.rotateX(direction,cam_dir_x,vec3.fromValues(0,0,0),-xFOV);
          //Get x range for all clusters that contains this light ball
          let xmin_int=this.get_pos(xmin,direction,xsegment) *this._xSlices;
          let xmax_int=this.get_pos(xmax,direction,xsegment) *this._xSlices;
          //Rotate Camera direction to down most
          direction=vec3.fromValues(0,0,1);
          vec3.rotateY(direction,cam_dir_y,vec3.fromValues(0,0,0),-yFOV);
          //Get y range for all clusters that contains this light ball
          let ymin_int=this.get_pos(ymin,direction,ysegment) *this._ySlices;
          let ymax_int=this.get_pos(ymax,direction,ysegment) *this._ySlices;
          //Get z range for all clusters that contains this light ball
          let zmin_int=Math.round(zmin[2]);
          let zmax_int=Math.round(zmax[2]);



/*
          vec3.set(pos,scene.lights[L].position[0], scene.lights[L].position[1], scene.lights[L].position[2]);
          vec4.set(light_pos4,
              scene.lights[L].position[0],
              scene.lights[L].position[1],
              scene.lights[L].position[2],
              1);

          vec4.transformMat4(light_pos4,light_pos4,viewMatrix);

          light_pos4[0] /=light_pos4[3];
          light_pos4[1] /=light_pos4[3];
          light_pos4[2] /=light_pos4[3];

          let xint=Math.round((1+light_pos4[0])*this._xSlices/2);
          let yint=Math.round((2-light_pos4[1])*this._ySlices/2);
          let zint=Math.round(light_pos4[2]*this._zSlices);
          */


          //Loop all clusters within bounding box
          for(let i=xmin_int;i<=xmax_int;i++)
          {
              for(let j=ymin_int;j<=ymax_int;j++)
              {
                  for(let k=zmin_int;k<=zmax_int;k++)
                  {
                      //Which Cluster
                      let index1= i + j * this._xSlices + k * this._xSlices * this._ySlices;
                      //how many lights are there already in the cluster
                      let light_num=this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index1, 0)];

                      if(light_num<MAX_LIGHTS_PER_CLUSTER)
                      {
                          //add one more light
                          light_num+=1;
                          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index1, 0)]=light_num;
                          //which texel in cluster
                          let clusterTexel = Math.floor(light_num/4.0);
                          //which position in the 4 slots of a texel
                          let reminder = light_num % 4;
                          //put the light index into buffer
                          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index1, clusterTexel+reminder)] = L;
                          totallights++;
                      }
                  }
              }
          }



          let index2= xint + yint * this._xSlices + zint * this._xSlices * this._ySlices;
          //how many lights are there already in the cluster
          let light_num2=this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index2, 0)];

          if(light_num2<MAX_LIGHTS_PER_CLUSTER)
          {
              //add one more light
              light_num2=light_num2+1;
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index2, 0)]=light_num2;
              //which texel in cluster
              let clusterTexel2 = Math.floor(light_num2/4.0);
              //which position in the 4 slots of a texel
              let reminder2 = light_num2 % 4;
              //put the light index into buffer
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index2, clusterTexel2+reminder2)] = L;
              totallights++;
          }



      }

      //TEST GLSL
/*
      for (let z = 0; z < this._zSlices; ++z) {
          for (let y = 0; y < this._ySlices; ++y) {
              for (let x = 0; x < this._xSlices; ++x) {

                  let index = x + y * this._xSlices + z * this._xSlices * this._ySlices;

                  for(let iii=1;iii<lightnumtotalinscene;iii++)
                  {
                      this._clusterTexture.buffer[this._clusterTexture.bufferIndex(index, 0)]=iii;

                      var LightTexel = Math.floor(iii * 0.25);
                      var LightTexelIndex = this._clusterTexture.bufferIndex(index, LightTexel);
                      var reminder = iii - LightTexel * 4;

                      this._clusterTexture.buffer[LightTexelIndex + reminder] = iii;

                  }}}}
 */


      console.log("Lights total= "+totallights);

    this._clusterTexture.update();
  }





    get_pos(dis , cam , segment)
    {
        //let angle=Math.acos( vec3.dot(vec3.normalize(dis,dis),cam)) * 180.0/Math.PI;
        let angle=vec3.angle(cam,dis);
        let seg=Math.round(0.5+(angle/segment));

        return seg;
    }

}