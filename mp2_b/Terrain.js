/**
 * @fileoverview Terrain - A simple 3D terrain using WebGL
 * @author Eric Shaffer
 */

/** Class implementing 3D terrain. */
class Terrain{   
/**
 * Initialize members of a Terrain object
 * @param {number} div Number of triangles along x axis and y axis
 * @param {number} minX Minimum X coordinate value
 * @param {number} maxX Maximum X coordinate value
 * @param {number} minY Minimum Y coordinate value
 * @param {number} maxY Maximum Y coordinate value
 */
    constructor(div,minX,maxX,minY,maxY){
        this.div = div;
        this.minX=minX;
        this.minY=minY;
        this.maxX=maxX;
        this.maxY=maxY;
        this.roughness = 0.005;
        
        // Allocate vertex array
        this.vBuffer = [];
        // Allocate triangle array
        this.fBuffer = [];
        // Allocate normal array
        this.nBuffer = [];
        // Allocate array for edges so we can draw wireframe
        this.eBuffer = [];
        
        this.cBuffer = [];
        
        this.count = [];
        
        console.log("Terrain: Allocated buffers");
        
        this.generateTriangles();
        console.log("Terrain: Generated triangles");
        
        this.generateLines();
        console.log("Terrain: Generated lines");
        
        this.generateDSA();
                
        this.generateColor();
        
        // Get extension for 4 byte integer indices for drwElements
        var ext = gl.getExtension('OES_element_index_uint');
        if (ext ==null){
            alert("OES_element_index_uint is unsupported by your browser and terrain generation cannot proceed.");
        }
    }
    
    /**
    * Set the x,y,z coords of a vertex at location(i,j)
    * @param {Object} v an an array of length 3 holding x,y,z coordinates
    * @param {number} i the ith row of vertices
    * @param {number} j the jth column of vertices
    */
    setVertex(v,i,j)
    {
        //Your code here
        var vid = 3*(i*(this.div+1) + j);
        this.vBuffer[vid] = v[0];
        this.vBuffer[vid+1] = v[1];
        this.vBuffer[vid+2] = v[2];
    }
    
    /**
    * Return the x,y,z coordinates of a vertex at location (i,j)
    * @param {Object} v an an array of length 3 holding x,y,z coordinates
    * @param {number} i the ith row of vertices
    * @param {number} j the jth column of vertices
    */
    getVertex(v,i,j)
    {
        //Your code here
        var vid = 3*(i*(this.div+1) + j);
        v[0] = this.vBuffer[vid];
        v[1] = this.vBuffer[vid+1];
        v[2] = this.vBuffer[vid+2];
    }
    
    /**
    * Send the buffer objects to WebGL for rendering 
    */
    loadBuffers()
    {
        // Specify the vertex coordinates
        this.VertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);      
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vBuffer), gl.STATIC_DRAW);
        this.VertexPositionBuffer.itemSize = 3;
        this.VertexPositionBuffer.numItems = this.numVertices;
        console.log("Loaded ", this.VertexPositionBuffer.numItems, " vertices");
    
        // Specify normals to be able to do lighting calculations
        this.VertexNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.nBuffer),
                  gl.STATIC_DRAW);
        this.VertexNormalBuffer.itemSize = 3;
        this.VertexNormalBuffer.numItems = this.numVertices;
        console.log("Loaded ", this.VertexNormalBuffer.numItems, " normals");
    
        // Specify faces of the terrain 
        this.IndexTriBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.fBuffer),
                  gl.STATIC_DRAW);
        this.IndexTriBuffer.itemSize = 1;
        this.IndexTriBuffer.numItems = this.fBuffer.length;
        console.log("Loaded ", this.numFaces, " triangles");
    
        // Specify colors to be able to show up 
        this.VertexColorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexColorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.cBuffer),
                  gl.STATIC_DRAW);
        this.VertexColorBuffer.itemSize = 4;
        this.VertexColorBuffer.numItems = this.cBuffer.length;
        console.log("Loaded ", this.VertexColorBuffer.numItems, " normals");

        
        //Setup Edges  
        this.IndexEdgeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexEdgeBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.eBuffer),
                  gl.STATIC_DRAW);
        this.IndexEdgeBuffer.itemSize = 1;
        this.IndexEdgeBuffer.numItems = this.eBuffer.length;
        
        console.log("triangulatedPlane: loadBuffers");
    }
    
    /**
    * Render the triangles 
    */
    drawTriangles(){
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.VertexPositionBuffer.itemSize, 
                         gl.FLOAT, false, 0, 0);

        // Bind normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
                           this.VertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);

        // Bind color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexColorBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, 
                           this.VertexColorBuffer.itemSize,
                           gl.FLOAT, false, 0, 0); 
    
        //Draw 
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
        gl.drawElements(gl.TRIANGLES, this.IndexTriBuffer.numItems, gl.UNSIGNED_INT,0);
    }
    
    /**
    * Render the triangle edges wireframe style 
    */
    drawEdges(){
    
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.VertexPositionBuffer.itemSize, 
                         gl.FLOAT, false, 0, 0);

        // Bind normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 
                           this.VertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0); 
        
        // Bind color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexColorBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, 
                           this.VertexColorBuffer.itemSize,
                           gl.FLOAT, false, 0, 0); 
    
        //Draw 
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexEdgeBuffer);
        gl.drawElements(gl.LINES, this.IndexEdgeBuffer.numItems, gl.UNSIGNED_INT,0);   
    }
/**
 * Fill the vertex and buffer arrays 
 */    
generateTriangles()
{
    //Your code here
    var x_amount = (this.maxX - this.minX) / this.div
    var y_amount = (this.maxY - this.minY) / this.div

    for (var i = 0; i <= this.div; i++) {
        for (var j = 0; j <= this.div; j++) {
            this.vBuffer.push(j*x_amount + this.minX)
            this.vBuffer.push(this.minY + i*y_amount)
            this.vBuffer.push(0)

            this.nBuffer.push(0)
            this.nBuffer.push(0)
            this.nBuffer.push(0)
            
            this.count.push(0)
            this.count.push(0)
            this.count.push(0)
        }
    }

    for (var i = 0; i < this.div; i++) {
        for (var j = 0; j < this.div; j++) {

            var vid = i*(this.div+1) + j
            
            // need change for getting the normal vector
            this.fBuffer.push(vid)
            this.fBuffer.push(vid + this.div+2)
            this.fBuffer.push(vid + this.div+1)

            this.fBuffer.push(vid)
            this.fBuffer.push(vid+1)
            this.fBuffer.push(vid + this.div+2)


        }
    }
    
    this.numVertices = this.vBuffer.length/3;
    this.numFaces = this.fBuffer.length/3;
}

/**
 * Print vertices and triangles to console for debugging
 */
printBuffers()
    {
        
    for(var i=0;i<this.numVertices;i++)
          {
           console.log("v ", this.vBuffer[i*3], " ", 
                             this.vBuffer[i*3 + 1], " ",
                             this.vBuffer[i*3 + 2], " ");
                       
          }
    
      for(var i=0;i<this.numFaces;i++)
          {
           console.log("f ", this.fBuffer[i*3], " ", 
                             this.fBuffer[i*3 + 1], " ",
                             this.fBuffer[i*3 + 2], " ");
                       
          }
        
    }

/**
 * Generates line values from faces in faceArray
 * to enable wireframe rendering
 */
generateLines()
{
    var numTris=this.fBuffer.length/3;
    for(var f=0;f<numTris;f++)
    {
        var fid=f*3;
        this.eBuffer.push(this.fBuffer[fid]);
        this.eBuffer.push(this.fBuffer[fid+1]);
        
        this.eBuffer.push(this.fBuffer[fid+1]);
        this.eBuffer.push(this.fBuffer[fid+2]);
        
        this.eBuffer.push(this.fBuffer[fid+2]);
        this.eBuffer.push(this.fBuffer[fid]);
    }
    
}
    
/**
 * Diamond Square Algorithm
 * reference: http://www.playfuljs.com/realistic-terrain-in-130-lines/
 */    
generateDSA(){
    var i, j;
    // Set height of the corners
    var c_vec = vec3.create();

    // Lower left
    this.getVertex(c_vec, 0, 0);
    c_vec[2] = 0.5;
    this.setVertex(c_vec, 0, 0);

    // Upper Left
    this.getVertex(c_vec, this.div, 0);
    c_vec[2] = 0.5;
    this.setVertex(c_vec, this.div, 0);

    // Lower Right
    this.getVertex(c_vec, 0, this.div);
    c_vec[2] = 0.5;
    this.setVertex(c_vec, 0, this.div);

    // Upper Right
    this.getVertex(c_vec, this.div, this.div);
    c_vec[2] = 0.5;
    this.setVertex(c_vec, this.div, this.div); 
    
    
    // recursivly approach DSA
    this.h_generateDSA(this.div);
    
    // normalize 
    var subTri21 = vec3.create();
    var subTri31 = vec3.create();
    var crossTri123 = vec3.create();
    
    for(i = 0; i < this.fBuffer.length; i += 3){
        // vec3.create(x, y, z)
        // get triangle
        var tri1 = vec3.fromValues(this.vBuffer[this.fBuffer[i] * 3], this.vBuffer[this.fBuffer[i] * 3 + 1], this.vBuffer[this.fBuffer[i] * 3 + 2]);
        var tri2 = vec3.fromValues(this.vBuffer[this.fBuffer[i + 1] * 3], this.vBuffer[this.fBuffer[i + 1] * 3 + 1], this.vBuffer[this.fBuffer[i + 1] * 3 + 2]);
        var tri3 = vec3.fromValues(this.vBuffer[this.fBuffer[i + 2] * 3], this.vBuffer[this.fBuffer[i + 2] * 3 + 1], this.vBuffer[this.fBuffer[i + 2] * 3 + 2]);
        
        vec3.subtract(subTri31, tri3, tri1);
        vec3.subtract(subTri21, tri2, tri1);

        vec3.cross(crossTri123, subTri21, subTri31);
        vec3.normalize(crossTri123, crossTri123);
        
        // add the normalized normal to the normalBuffer
        this.nBuffer[this.fBuffer[i] * 3] += crossTri123[0];
        this.nBuffer[this.fBuffer[i] * 3 + 1] += crossTri123[1];
        this.nBuffer[this.fBuffer[i] * 3 + 2] += crossTri123[2];
        this.count[this.fBuffer[i] * 3]++;
        
        this.nBuffer[this.fBuffer[i + 1] * 3] += crossTri123[0];
        this.nBuffer[this.fBuffer[i + 1] * 3 + 1] += crossTri123[1];
        this.nBuffer[this.fBuffer[i + 1] * 3 + 2] += crossTri123[2];
        this.count[this.fBuffer[i + 1] * 3] += 1;
        
        this.nBuffer[this.fBuffer[i + 2] * 3] += crossTri123[0];
        this.nBuffer[this.fBuffer[i + 2] * 3 + 1] += crossTri123[1];
        this.nBuffer[this.fBuffer[i + 2] * 3 + 2] += crossTri123[2];
        this.count[this.fBuffer[i + 2] * 3] += 1;
    }
    
    // Average the normals
    // and reset with average
    for(i = 0; i < this.nBuffer.length; i += 3){
        var normV = vec3.fromValues(this.nBuffer[i],this.nBuffer[i+1],this.nBuffer[i+2]);
        normV[0] = normV[0] / this.count[i];
        normV[1] = normV[1] / this.count[i];
        normV[2] = normV[2] / this.count[i];  
       
        vec3.normalize(normV,normV);
        this.nBuffer[i]= normV[0];
        this.nBuffer[i+1]= normV[1];
        this.nBuffer[i+2]= normV[2];       
    }
}

/**
 * Diamond Square Algorithm Recursion
 */    
h_generateDSA(size){
    var j;
    var i;
    var h_size = size / 2;
    var scale = this.roughness * size;
    
    // Check if we are done
    if(h_size < 1){
        return;
    }
    
    // Do Diamond Step
    for(j = h_size; j < this.div; j += size){
        for(i = h_size; i < this.div; i += size){
            this.diamondStep(i, j, h_size, ((Math.random() * scale * 2 - scale) / 2));
        }
    }

    // Do Square Step
    for(j = 0; j <= this.div; j += h_size){
        for(i = (j + h_size) % size; i <= this.div; i += size){
            this.squareStep(i, j, h_size, ((Math.random() * scale * 2 - scale) / 2));
        }
    }

    this.h_generateDSA(size / 2);    
}
 
/**
 * Diamond Square Algorithm: Diamond step
 */    
diamondStep(x, y, size, randomRoughness){
    var height;
    var mid_v = vec3.create();
    var bl = vec3.create();
    var tl = vec3.create();
    var br = vec3.create();
    var tr = vec3.create();

    this.getVertex(mid_v, y, x);
    
    // average BL TL BR TR
    this.getVertex(bl, y - size, x - size);
    this.getVertex(tl, y + size, x - size);
    this.getVertex(br, y - size, x + size);
    this.getVertex(tr, y + size, x + size);

    // add up with random variable
    height = (bl[2] + tl[2] + br[2] + tr[2]) / 4 + randomRoughness;

    mid_v[2] = height;

    // assign the z value that DSA has output
    this.setVertex(mid_v, y, x);
}

/**
 * Diamond Square Algorithm: Square step
 */  
squareStep(x, y, size, randomRoughness){
    var height;
    var count = 4;
    var mid_v = vec3.create();
    var l = vec3.create();
    var r = vec3.create();
    var b = vec3.create();
    var t = vec3.create();

    this.getVertex(mid_v, y, x);

    // check boundaries
    // if not out of boundary get the height for averaging
    // else don't add up to the average
    // Left
    if(x - size < 0){
        l[2] = 0;
        count -= 1;  
    }
    else{
        this.getVertex(l, y, x - size);
    }

    // Right
    if(x + size > this.div){
        r[2] = 0;
        count -= 1;  
    }
    else{
        this.getVertex(r, y, x + size);
    }

    // Top
    if(y + size > this.div){
        t[2] = 0;
        count -= 1;  
    }
    else{
        this.getVertex(t, y + size, x);
    }

    // Bottom
    if(y - size < 0){
        b[2] = 0;
        count -= 1;  
    }
    else{
        this.getVertex(b, y - size, x);
    }

    height = (l[2] + r[2] + t[2] + b[2]) / count + randomRoughness;

    mid_v[2] = height;

    this.setVertex(mid_v, y, x);
}
    
/**
 * Color the Terrain differentiating each other with height
 * cBuffer is empty at the beginning so push RGBalpha
 */  
generateColor(){
    var i;
    for(i = 0; i < this.vBuffer.length; i += 3){
        // random colors according to the height
        if(this.vBuffer[i + 2] < 0.35){
            this.cBuffer.push(0.9);
            this.cBuffer.push(0.3);
            this.cBuffer.push(0.1);
            this.cBuffer.push(1.0);
        }
        else if(this.vBuffer[i + 2] < 0.40){
            this.cBuffer.push(0.6);
            this.cBuffer.push(0.6);
            this.cBuffer.push(0.2);
            this.cBuffer.push(1.0);
        }
        else if(this.vBuffer[i + 2] < 0.45){
            this.cBuffer.push(0.7);
            this.cBuffer.push(0.5);
            this.cBuffer.push(0.2);
            this.cBuffer.push(1.0);
        }
        
        else if(this.vBuffer[i + 2] < 0.5){
            this.cBuffer.push(0.2);
            this.cBuffer.push(0.8);
            this.cBuffer.push(0.6);
            this.cBuffer.push(1.0);
        }
    
        else if(this.vBuffer[i + 2] < 0.52){
            this.cBuffer.push(0.9);
            this.cBuffer.push(0.9);
            this.cBuffer.push(0.2);
            this.cBuffer.push(1.0);
        }
        
        else if(this.vBuffer[i + 2] < 0.55){
            this.cBuffer.push(0.3);
            this.cBuffer.push(0.3);
            this.cBuffer.push(0.7);
            this.cBuffer.push(1.0);
        }
        
        else if(this.vBuffer[i + 2] < 0.7){
            this.cBuffer.push(0.55);
            this.cBuffer.push(0.55);
            this.cBuffer.push(0.55);
            this.cBuffer.push(1.0);
        }
        
        else{
            this.cBuffer.push(0.0);
            this.cBuffer.push(0.3);
            this.cBuffer.push(0.9);
            this.cBuffer.push(1.0);
        }
    }
}
    
}
