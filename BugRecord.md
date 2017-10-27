1. Inproper way of finding begin_x and end_x
2. Use viewMatrix * v_position instead of gl_fragCoor * u_invProjectioMatrix
3. In cluster.js,when read light count from texture, parseInt.
4. In any glsl, after using (u_viewMatrix * v_position), divide it by w to get right value.