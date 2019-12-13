/**
 * @file A simple WebGL example for wall collision between particles.
 * However, no collision between particles
 * @author Hoesuh Jeong <hjeong13@illinois.edu>  
 */

var gl;
var canvas;
var shaderProgram;
var vertexPositionBuffer;


// Create a place to store the textures
// Variable to count the number of textures loaded
// Create a place to store sphere geometry
var sphereVertexPositionBuffer;

//Create a place to store normals for shading
var sphereVertexNormalBuffer;

// View parameters
var eyePt = vec3.fromValues(0.0,0.0, 50.0);
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);

// Create the normal
var nMatrix = mat3.create();

// Create ModelView matrix
var mvMatrix = mat4.create();

//Create Projection matrix
var pMatrix = mat4.create();

var mvMatrixStack = [];

var position = [];
var velocity = [];
var radius = [];
var color = [];
var mass = [];

var shininess = 50;

var gravity = 9.85;
var friction = 0.8;
var count = 0;


var currentTime = Date.now();
var previousTime = Date.now();



//-------------------------------------------------------------------------
/**
 * Populates buffers with data for spheres
 */
function setupSphereBuffers() {
    
    var sphereSoup=[];
    var sphereNormals=[];
    var numT=sphereFromSubdivision(6,sphereSoup,sphereNormals);
    console.log("Generated ", numT, " triangles"); 
    sphereVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);      
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereSoup), gl.STATIC_DRAW);
    sphereVertexPositionBuffer.itemSize = 3;
    sphereVertexPositionBuffer.numItems = numT*3;
    console.log(sphereSoup.length/9);
    
    // Specify normals to be able to do lighting calculations
    sphereVertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereNormals),
                  gl.STATIC_DRAW);
    sphereVertexNormalBuffer.itemSize = 3;
    sphereVertexNormalBuffer.numItems = numT*3;
    
    console.log("Normals ", sphereNormals.length/3);     
}

//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, 
                      false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 */
function uploadNormalMatrixToShader() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(shaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColorLoc, s);
}



//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}
//---------------------------------------------------------------------------------
/**
 * @param {number} value Value to determine whether it is a power of 2
 * @return {boolean} Boolean of whether value is a power of 2
 */
function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
  if (!shaderScript) {
    return null;
  }
  
  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
 
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
 
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
 
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader;
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
  vertexShader = loadShaderFromDOM("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-fs");
  
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(shaderProgram);

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  shaderProgram.uniformShininessLoc = gl.getUniformLocation(shaderProgram, "uShininess");    
  shaderProgram.uniformAmbientMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKAmbient");  
  shaderProgram.uniformDiffuseMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKDiffuse");
  shaderProgram.uniformSpecularMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKSpecular");

}

//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
 */
function setupBuffers() {
    setupSphereBuffers();     
}

//-------------------------------------------------------------------------
/**
 * Draws a sphere from the sphere buffer
 */
function drawSphere(){
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, sphereVertexPositionBuffer.itemSize, 
                         gl.FLOAT, false, 0, 0);

  // Bind normal buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVertexNormalBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
                           sphereVertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);

  // Set the texture for the cube map.
  gl.drawArrays(gl.TRIANGLES, 0, sphereVertexPositionBuffer.numItems);      
}

//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() { 
    var transformVec = vec3.create();
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    mat4.perspective(pMatrix,degToRad(45), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);

    // Then generate the lookat matrix and initialize the MV matrix to that view    
    setLightUniforms([20, 20, 20], [0.0, 0.0, 0.0], [1.0, 1.0, 1.0], [1.0, 1.0, 1.0]);
    //mat4.lookAt(mvMatrix,eyePt,viewPt,up); 
    vec3.add(viewPt,eyePt,viewDir);
    mat4.lookAt(mvMatrix,eyePt,viewPt,up);

    for(var i = 0; i < count; i++){
        mvPushMatrix();
        vec3.set(transformVec, position[3 * i], position[3 * i + 1], position[3 * i + 2]);
        mat4.translate(mvMatrix, mvMatrix, transformVec);
        vec3.set(transformVec, radius[i], radius[i], radius[i]);
        mat4.translate(mvMatrix, mvMatrix, transformVec);
    setLightUniforms([20, 20, 20], [0.0, 0.0, 0.0], [1.0, 1.0, 1.0], [1.0, 1.0, 1.0]);

        setMaterialUniforms(shininess,[color[3 * i], color[3 * i + 1], color[3 * i + 2]],[color[3 * i], color[3 * i + 1], color[3 * i + 2]], [1.0, 1.0, 1.0]);
        setMatrixUniforms();
        
        drawSphere();
        mvPopMatrix();
    }
    //mvPopMatrix();
}

//----------------------------------------------------------------------------------
/**
 * Animation to be called from tick. Updates globals and performs animation for each tick.
 */
function animate() {
    currentTime = Date.now();
    var t = (currentTime - previousTime);
    t = t / 100;
    console.log(t);
    previousTime = currentTime;
    
    for(var i = 0; i < count; i++){
        //compute new particle positions
        position[3 * i] += velocity[3 * i] * t ;
        position[3 * i + 1] += velocity[3 * i + 1] * t ;
        position[3 * i + 2] += velocity[3 * i + 2] * t ;
        
        //if hit wall: new particle positions
        if(position[3 * i] + radius[i] > 15.0){
            position[3 * i] = 15.0 - radius[i]; 
            velocity[3 * i] *= -1.0;
        }
        
        else if(position[3 * i] - radius[i] < -15.0){
            position[3 * i] = -15.0 + radius[i]; 
            velocity[3 * i] *= -1.0;
        }
        
        if(position[3 * i + 1] + radius[i]> 15.0){
            position[3 * i + 1] = 15.0 - radius[i]; 
            velocity[3 * i + 1] *= -1.0;
        }
        
        else if(position[3 * i + 1] - radius[i] < -15.0){
            position[3 * i + 1] = -15.0 + radius[i]; 
            velocity[3 * i + 1] *= -1.0;
        }
        
        if(position[3 * i + 2] + radius[i] > 15.0){
            position[3 * i + 2] = 15.0 - radius[i]; 
            velocity[3 * i + 2] *= -1.0;
        }
        
        else if(position[3 * i + 2] - radius[i] < -15.0){
            position[3 * i + 2] = -15.0 + radius[i]; 
            velocity[3 * i + 2] *= -1.0;
        }
        //compute new particle velocity
        velocity[3 * i] = velocity[3 * i] * 0.99;
        velocity[3 * i + 1] = velocity[3 * i + 1] * 0.99 - 9.85 * t;
        velocity[3 * i + 2] = velocity[3 * i + 2] * 0.99;
    }
//    console.log(position);    
//    var eulerDt = Math.pow(friction, t);
    //console.log(gravity * t * 0.001, velocity[3 * i + 1]);
        
//    velocity[3 * i] = velocity[3 * i] * 0.9;
//    console.log(velocity[0]);  
//    console.log(velocity[3 * i + 1]);
//    velocity[3 * i + 1] = velocity[3 * i + 1] * 0.9 - 9.85 * t * 0.01;
//    console.log(velocity[3 * i + 1]);
//    console.log(velocity[3 * i + 1]);
//    velocity[3 * i + 2] = velocity[3 * i + 2] * 0.9;
        
}
//    
//    for(var i = 0; i < count; i++){
//       position[3 * i] += 0.001;
//    }
       //position[3 * i + 1] += velocity[3 * i + 1] * t;
       //position[3 * i + 2] += velocity[3 * i + 2] * t;

//----------------------------------------------------------------------------------
/**
 * Update the rotation variable when a key is pressed.
 * @param {Event} event Specifies which key is being pressed
 */
function handleKeyDown(event) {
    event.preventDefault();

    if (event["key"] == "ArrowLeft") {
        //erase all particles
        console.log("clear");
        for(var i = 0; i < count; i++){
            for(var j = 0; j < 3; j++){
                position.pop();
                velocity.pop();
                color.pop();
            }
            mass.pop();
            radius.pop();
        }
        //console.log(position[0]);
        count = 0;
    } else if (event["key"] == "ArrowRight") {
        if(count < 20){
            console.log("Added ");            
            //push the new particle info
            position.push(getRandomInt(5));
            position.push(getRandomInt(5));
            position.push(getRandomInt(5));
            
            velocity.push(getRandomInt(5));
            velocity.push(getRandomInt(20));
            velocity.push(getRandomInt(5));
            
            color.push(Math.random());
            color.push(Math.random());
            color.push(Math.random());
            
            radius.push(0.3);
            
            mass.push(getRandomInt(2));

            count++;
        }
    }
}

//Bound random function
function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max)) * 1.0;
}

/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  document.addEventListener("keydown", handleKeyDown);
  gl = createGLContext(canvas);
  setupShaders();
  setupBuffers();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  tick();
}

//----------------------------------------------------------------------------------
/**
 * Tick called for every animation frame.
 */
function tick() {
    requestAnimFrame(tick);
    draw();
    animate();
}

