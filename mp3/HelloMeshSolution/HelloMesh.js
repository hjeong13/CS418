
/**
 * @file A simple WebGL example for viewing meshes read from OBJ files
 * @author Eric Shaffer <shaffer1@illinois.edu>  
 */
// One shader with switch case!

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;
var shaderProgramCube;

/** @global The Modelview matrix */
var mvMatrix = mat4.create();

/** @global The View matrix */
var vMatrix = mat4.create();

/** @global The Projection matrix */
var pMatrix = mat4.create();

/** @global The Normal matrix */
var nMatrix = mat3.create();

/** @global The matrix stack for hierarchical modeling */
var mvMatrixStack = [];

/** @global An object holding the geometry for a 3D mesh */
var myMesh;

// Create a place to store the textures
var cubeImage0;
var cubeImage1;
var cubeImage2;
var cubeImage3;
var cubeImage4;
var cubeImage5;
var cubeImages = [cubeImage0, cubeImage1, cubeImage2, cubeImage3, cubeImage4, cubeImage5]
var cubeMap;

// Variable to count the number of textures loaded
var texturesLoaded = 0;

// Create a place to store the texture coords for the mesh
var cubeTCoordBuffer;

// Create a place to store terrain geometry
var cubeVertexPositionBuffer;
var cubeVertexNormalBuffer;

// Create a place to store the triangles
var cubeTriIndexBuffer;


// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0.0,5.0,30.0);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,0.0,0.0);

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [5,5,5];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0,0,0];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[1,1,1];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [1,1,1];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [1,1,1];
/** @global Shininess exponent for Phong reflection */
var shininess = 50;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];


//Model parameters
var eulerY=0;
var eulerT = 0;

var cubeQuat = quat.create();
var teapotQuat = quat.create();

//-------------------------------------------------------------------------
/**
 * Asynchronously read a server-side text file
 */
function asyncGetFile(url) {
  console.log("Getting text file");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(xhr.statusText);
    xhr.send();
    console.log("Made promise");  
  });
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

  // added
  shaderProgram.uCubeSampler = gl.getUniformLocation(shaderProgram, "uCubeSampler");
  shaderProgram.uEnvironment = gl.getUniformLocation(shaderProgram, "uEnvironment");
  shaderProgram.uReflective = gl.getUniformLocation(shaderProgram, "uReflective");
  
}

//-------------------------------------------------------------------------
/**
 * Sends material information to the shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Diffuse material color
 * @param {Float32Array} s Specular material color
 */
function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(shaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColorLoc, s);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the shader
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//----------------------------------------------------------------------------------
/**
 * Populate buffers with data
 */
function setupMesh(filename) {
    myMesh = new TriMesh();
    myPromise = asyncGetFile(filename);
    // We define what to do when the promise is resolved with the then() call,
    // and what to do when the promise is rejected with the catch() call
    myPromise.then((retrievedText) => {
        myMesh.loadFromOBJ(retrievedText);
        console.log("Yay! got the file");
    })
    .catch(
        // Log the rejection reason
       (reason) => {
            console.log('Handle rejected promise ('+reason+') here.');
        });
}

//----------------------------------------------------------------------------------


// Straight from lab
function setupCubeBuffers() {

  // Create a buffer for the cube's vertices.

  cubeVertexPositionBuffer = gl.createBuffer();

  // Select the cubeVerticesBuffer as the one to apply vertex
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);

  // Now create an array of vertices for the cube.
  cubeVertexPositionBuffer.itemSize = 3;
  var vertices = [
    // Front face
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,

    // Back face
    -1.0, -1.0, -1.0,
    -1.0,  1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0, -1.0, -1.0,

    // Top face
    -1.0,  1.0, -1.0,
    -1.0,  1.0,  1.0,
     1.0,  1.0,  1.0,
     1.0,  1.0, -1.0,

    // Bottom face
    -1.0, -1.0, -1.0,
     1.0, -1.0, -1.0,
     1.0, -1.0,  1.0,
    -1.0, -1.0,  1.0,

    // Right face
     1.0, -1.0, -1.0,
     1.0,  1.0, -1.0,
     1.0,  1.0,  1.0,
     1.0, -1.0,  1.0,

    // Left face
    -1.0, -1.0, -1.0,
    -1.0, -1.0,  1.0,
    -1.0,  1.0,  1.0,
    -1.0,  1.0, -1.0
  ];
    
  for(var i = 0; i < vertices.length; i++){
      vertices[i] *= 50;
  }

  // Now pass the list of vertices into WebGL to build the shape. We
  // do this by creating a Float32Array from the JavaScript array,
  // then use it to fill the current vertex buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Map the texture onto the cube's faces.

  cubeTCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTCoordBuffer);

  var textureCoordinates = [
    // Front
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Back
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Top
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Bottom
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Right
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Left
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertices.

  cubeTriIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  var cubeVertexIndices = [
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23    // left
  ]

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
    
        
  // Create Normal Buffer
  // TriMesh
  numNormals = vertices.length / 3;
  normal = new Array(numNormals * 3);
  
  for(var i = 0; i < normal.length; i++){
      normal[i] = 0;
  }

  for(var i = 0; i < cubeVertexIndices.length / 3; i++){
      var v1 = cubeVertexIndices[3 * i];
      var v1Vec = vec3.fromValues(vertices[3 * v1], vertices[3 * v1 + 1], vertices[3 * v1 + 2]);
      
      var v2 = cubeVertexIndices[3 * i + 1];
      var v2Vec = vec3.fromValues(vertices[3 * v2], vertices[3 * v2 + 1], vertices[3 * v2 + 2]);
      
      var v3 = cubeVertexIndices[3 * i + 2];
      var v3Vec = vec3.fromValues(vertices[3 * v3], vertices[3 * v3 + 1], vertices[3 * v3 + 2]);
      
      var e1 = vec3.create();
      vec3.subtract(e1, v2Vec, v1Vec);
      var e2 = vec3.create();
      vec3.subtract(e2, v3Vec, v1Vec);
      
      var n = vec3.fromValues(0, 0, 0);
      vec3.cross(n, e1, e2);
      
      for (var j = 0; j < 3; j++){
          normal[3 * v1 + j] += n[j];
          normal[3 * v2 + j] += n[j];
          normal[3 * v3 + j] += n[j];
      }   
  }
  for(var i = 0; i < numNormals; i++){
      var n = vec3.fromValues(normal[3 * i], normal[3 * i + 1], normal[3 * i + 2]);
      
      vec3.normalize(n, n);
      normal[3*i] = n[0];
      normal[3*i+1] = n[1];
      normal[3*i+2] = n[2];
  }
    
// copy it to buffer so that it can be sent to the GL
  cubeVertexNormalBuffer = gl.createBuffer();
  cubeVertexNormalBuffer.itemSize = 3;
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normal), gl.STATIC_DRAW);

}


/**
 * Draw a cube based on buffers.
 */
function drawCube(){
  // Draw the cube by binding the array buffer to the cube's vertices
  // array, setting attributes, and pushing it to GL.
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Set the texture coordinates attribute for the vertices.

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexNormalBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, cubeVertexNormalBuffer.size, gl.FLOAT, false, 0, 0);

  // Specify the texture to map onto the faces.

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap);
  gl.uniform1i(gl.getUniformLocation(shaderProgram, "uCubeSampler"), 0);
  gl.uniform1i(shaderProgram.uEnvironment, 1);

  // Draw the cube.

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}


//-------------------------------------------------------------------------
/**
 * Asynchronously read a server-side text file
 */
function asyncGetBoxFile(url, face) {
  console.log("Getting image");
  return new Promise((resolve, reject) => {
    cubeImages[face] = new Image();
    cubeImages[face].onload = () => resolve({url, status: 'ok'});
    cubeImages[face].onerror = () => reject({url, status: 'error'});
    cubeImages[face].src = url
    console.log("Made promise");  
  });
}
//----------------------------------------------------------------------------------
/**
 * Setup a promise to load a texture
 */
function setupPromise(filename, face) {
    myPromise = asyncGetBoxFile(filename, face);
    // We define what to do when the promise is resolved with the then() call,
    // and what to do when the promise is rejected with the catch() call
    myPromise.then((status) => {
        handleTextureLoaded(cubeImages[face], face)
        console.log("Yay! got the file");
    })
    .catch(
        // Log the rejection reason
       (reason) => {
            console.log('Handle rejected promise ('+reason+') here.');
        });
}

//----------------------------------------------------------------------------------
/**
 * Creates textures for application to cube.
 */
function setupTextures() {

  cubeMap = gl.createTexture();
  setupPromise("pos-z.png", 0);
  setupPromise("neg-z.png", 1);
  setupPromise("pos-y.png", 2);
  setupPromise("neg-y.png", 3);
  setupPromise("pos-x.png", 4);
  setupPromise("neg-x.png", 5);

}
//----------------------------------------------------------------------------------
/**
 * Texture handling. Generates mipmap and sets texture parameters.
 * @param {Object} image Image for cube application
 * @param {Number} face Which face of the cubeMap to add texture to
 */
function handleTextureLoaded(image, face) {

  // CODE GOES HERE
    texturesLoaded++;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap);
    
    if(face == 0){
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    } else if(face == 1) {
         gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);       
    } else if(face == 2) {
         gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);       
    } else if(face == 3) {
         gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);       
    } else if(face == 4) {
         gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);       
    } else if(face == 5) {
         gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);       
    }
    
   gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);    
}

/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() { 
    //console.log("function draw()")
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    mat4.perspective(pMatrix,degToRad(45), 
                     gl.viewportWidth / gl.viewportHeight,
                     0.1, 500.0);

    // We want to look down -z, so create a lookat point in that direction    
    //vec3.add(viewPt, eyePt, viewDir);
    
    // Rotate Cube effect
    // move eyePt
    quat.setAxisAngle(cubeQuat, up, 0.03 * eulerY);
    vec3.transformQuat(eyePt, eyePt, cubeQuat);
    eulerY = 0;
    // Then generate the lookat matrix and initialize the view matrix to that view
    mat4.lookAt(mvMatrix,eyePt,viewPt,up);
    
    // Rotate Teapot
    if(eulerT != 0){
        quat.setAxisAngle(teapotQuat, up, 0.03 * eulerT);
        var tempVec = vec3.create();
        var i;
        if(myMesh.isLoaded){
            // change the teapot's position, normal and position vector
            for(i = 0; i < myMesh.VertexPositionBuffer.numItems; i++){
                myMesh.getVertex(i, tempVec);
                vec3.transformQuat(tempVec, tempVec, teapotQuat);
                myMesh.setVertex(i, tempVec);
                myMesh.getNormal(i, tempVec);
                vec3.transformQuat(tempVec, tempVec, teapotQuat);
                myMesh.setNormal(i, tempVec);
                myMesh.updateBuffers();
                // takes too much time!!!!!!!!!
                //myMesh.generateNormals();
                //myMesh.loadBuffers();
            }
        }
        eulerT = 0;
    }
    
    //Draw Mesh
    if (myMesh.loaded() == true){
        mvPushMatrix();
        //mat4.rotateY(mvMatrix, mvMatrix, degToRad(eulerY));
        //mat4.multiply(mvMatrix,vMatrix,mvMatrix);
        setMatrixUniforms();
        
        // Don't move the light
        // setLightUniforms([1.0, 1.0, 1.0],lAmbient,lDiffuse,lSpecular);
        setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);
        
        // Reflective
        if (document.getElementById("reflective").checked)
        {
            setMaterialUniforms(shininess,kAmbient,
                                kTerrainDiffuse,kSpecular); 
            gl.uniform1i(shaderProgram.uReflective, 1);
            drawCube();
            myMesh.drawTriangles();
        }
        // nonReflective
        else{
            setMaterialUniforms(shininess,kAmbient,
                                kTerrainDiffuse,kSpecular); 
            gl.uniform1i(shaderProgram.uReflective, 0);
            drawCube();
            myMesh.drawTriangles();
        }
        mvPopMatrix();
    }
  
}

//----------------------------------------------------------------------------------
//Code to handle user interaction
var currentlyPressedKeys = {};

function handleKeyDown(event) {
        //console.log("Key down ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = true;
          if (currentlyPressedKeys["a"]) {
            // key A
            eulerY-= 1;
        } else if (currentlyPressedKeys["d"]) {
            // key D
            eulerY+= 1;
        } 
    
    
        currentlyPressedKeys[event.key] = true;
          if (currentlyPressedKeys["ArrowLeft"]) {
            // key A
            eulerT-= 1;
        } else if (currentlyPressedKeys["ArrowRight"]) {
            // key D
            eulerT+= 1;
        } 
    
        if (currentlyPressedKeys["ArrowUp"]){
            // Up cursor key
            event.preventDefault();
            eyePt[2]+= 0.01;
        } else if (currentlyPressedKeys["ArrowDown"]){
            event.preventDefault();
            // Down cursor key
            eyePt[2]-= 0.01;
        } 
    
}

function handleKeyUp(event) {
        //console.log("Key up ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = false;
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders();
  setupCubeBuffers();
  setupTextures();
  setupMesh("teapot.obj");
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  tick();
}


//----------------------------------------------------------------------------------
/**
  * Update any model transformations
  */
function animate() {
   //console.log(eulerX, " ", eulerY, " ", eulerZ); 
}


//----------------------------------------------------------------------------------
/**
 * Keeping drawing frames....
 */
function tick() {
    requestAnimFrame(tick);
    animate();
    draw();
}

