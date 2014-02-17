// Gravity of the world.
var GRAVITY = -2;

// Time step to use for verlet integration.
var DELTA_TIME = 0.3;

// How many times to solve the constraints before rendering.
var CONSTRAINT_ITERATIONS = 6;

// Length between two points such that no attraction or repulsive 'forces' are applied.
var REST_LENGTH = 15;

// Location to place the cloth in the canvas.
var offset_x = 45;
var offset_y = 90;

// Whether to tear the cloth while clicking and dragging.
var tearCloth = false;

// Whether the user is clicking and dragging.
var isDragging = false;

// Whether to anchor the currently active particle.
var anchorCloth = false;

window.onkeydown = function (evt) {
    if (evt.keyCode === 84) tearCloth = true;
    if (evt.keyCode === 65) anchorCloth = true;
};

window.onkeyup = function(evt) {
    if (evt.keyCode === 84) tearCloth = false;
};

/**
 * The world that houses the canvas and cloth.
 */
function World (canvasEl) {
    this.canvas = canvasEl.getContext('2d');
    this.canvas.lineWidth = 0.5;
    this.canvas.strokeStyle = "#333";

    this.width = canvasEl.width;
    this.height = canvasEl.height;

    // Flip the canvas such that (0,0) is at the bottom left.
    this.canvas.translate(0, this.canvas.canvas.height);
    this.canvas.scale(1, -1);

    this.cloth = new Cloth([offset_x, offset_y], 35, 20, canvasEl);
}

/**
 * Begins the render loop.
 */
World.prototype.start = function () {
    var frame = window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame;
    var frameWrapper = function(){
        this.render();
        frame(frameWrapper);
    }.bind(this);
    frameWrapper();
};

/**
 * Render loop. Applies verlet integration, solves constraints, and finally draws the result.
 */
World.prototype.render = function () {
    // Clear the canvas area.
    this.canvas.clearRect(0, 0, this.width, this.height);

    // Apply verlet integration.
    this.cloth.applyVerlet();

    // Relaxes constraints before drawing.
    this.cloth.solveConstraints();

    // Draw the cloth.
    this.cloth.draw(this.canvas);
};

/**
 * The cloth object. Houses point masses and their constraints.
 */
function Cloth (pos, x, y, canvasEl) {
    this.el = canvasEl;
    this.particles = [];
    this.constraints = [];
    this.anchors = [];

    // Create and add new particles to the cloth in a grid.
    for (var i = 0; i < x; i++) {
        var arr = [];
        for (var j = 0; j < y; j++) {
            var par = new Particle([
                pos[0] + i*REST_LENGTH,
                pos[1] + j*REST_LENGTH], 0.5);
            arr.push(par);
        }
        this.particles.push(arr);
    }

    this.length = y;
    this.width = x;

    // Currently held down particle (active).
    this.activeParticle = null;

    // The following few ugly for loops are to create the constraints.
    // A similar code structure is seen in the draw() method in order to draw these constraints.
    for (var i = 0; i < x-1; i++) {
        this.constraints.push({
            pA: this.particles[i+1][y - 1],
            pB: this.particles[i][y - 1],
            restLength: REST_LENGTH
        });

        for (var j = 0; j < y-1; j++) {
            this.constraints.push({
                pA: this.particles[i+1][j],
                pB: this.particles[i][j],
                restLength: REST_LENGTH
            });
            this.constraints.push({
                pA: this.particles[i][j+1],
                pB: this.particles[i][j],
                restLength: REST_LENGTH
            });
        }
    }

    for (var j = 0; j < y-1; j++) {
        this.constraints.push({
            pA: this.particles[x-1][j+1],
            pB: this.particles[x-1][j],
            restLength: REST_LENGTH
        });
    }

    this.setupEvents();

    // Set up physics by applying gravity to each point mass.
    this.setupPhysics();
}

/**
 * Sets up event callbacks for user interactions with the cloth.
 */
Cloth.prototype.setupEvents = function () {
    this.el.onmousedown = function (evt) {
        anchorCloth = false;
        isDragging = true;

        // If we are not tearing the cloth, we want to activate the closest particle.
        if (!tearCloth) {
            var pos = getCanvasClickLoc(evt, this.el);
            var closest = this.particles[0][0];
            var closestDist = 10000;
            this.particles.forEach(function(pArr) {
                pArr.forEach(function(p) {

                    // Use the distance approximation rather than the expensive sqrt.
                    var dist = approxDist(p.x-pos.x, p.y-pos.y);
                    if (dist < closestDist) {
                        closest = p;
                        closestDist = dist;
                    }
                });
            });
            this.activeParticle = closest;
        }
    }.bind(this);

    this.el.onmousemove = function(evt) {
        // If the mouse is currently dragging (to avoid this being called only on mouseover).
        if (isDragging) {
            var pos = getCanvasClickLoc(evt, this.el);

            // Anchor the active particle temporarily (until mouseup).
            if (this.activeParticle) {
                this.activeParticle.anchorx = pos.x;
                this.activeParticle.anchory = pos.y;

                if (!this.activeParticle.anchored) {
                    this.anchors.push(this.activeParticle);
                    this.activeParticle.anchored = true;
                }
            } else if (tearCloth) {
                // If the user wants to tear the cloth.
                this.constraints.forEach(function(c) {
                    var dCx = (c.pA.x + c.pB.x)/2 - pos.x;
                    var dCy = (c.pA.y + c.pB.y)/2 - pos.y;

                    if (dCx < 0) dCx = -dCx;
                    if (dCy < 0) dCy = -dCy;

                    if (dCx < REST_LENGTH && dCy < REST_LENGTH) {
                        this.constraints.splice(this.constraints.indexOf(c), 1);
                    }
                }.bind(this));
            }
        }
    }.bind(this);

    this.el.onmouseup = function(evt) {
        // If there exists an active particle which we do not want to anchor,
        // potentially un-anchor it.
        if (this.activeParticle && !anchorCloth) {
            this.activeParticle.anchored = false;

            // Remove the active particle from the list of anchors.
            var ind = this.anchors.indexOf(this.activeParticle);
            if (ind > -1) this.anchors.splice(ind, 1);
        }   

        this.activeParticle = null;

        // Reset flags to false (after mouseup we shouldn't be anchoring, tearing, or dragging).
        isDragging = false;
        anchorCloth = false;
        tearCloth = false;
    }.bind(this);
}
/**
 * Sets up physics by applying gravity to each point mass.
 * Also declares which particles are initialized as anchors.
 */
Cloth.prototype.setupPhysics = function () {
    for (var i = 0; i < this.width; i++) {
        for (var j = 0; j < this.length; j++) {
           this.particles[i][j].ay = GRAVITY;
        }
    }

    // Anchored particles (not affected by gravity or anything else).
    this.particles[0][this.length-1].anchored = true;
    this.particles[this.width-1][this.length-1].anchored = true;
    this.particles[(this.width-1)/2][this.length-1].anchored = true;
    this.anchors.push(this.particles[(this.width-1)/2][this.length-1]);
    this.anchors.push(this.particles[0][this.length-1]);
    this.anchors.push(this.particles[this.width-1][this.length-1]);
};

/**
 * Verlet integration (velocity-less equations of motion).
 */
Cloth.prototype.applyVerlet = function () {
    for (var i = 0; i < this.width; i++) {
        for (var j = 0; j < this.length; j++) {
            var p = this.particles[i][j];
            var tx = p.x;
            var ty = p.y;
            var ax = p.ax;
            var ay = p.ay;
            p.x += (p.x - p.old_x) + ax*DELTA_TIME*DELTA_TIME;
            p.y += (p.y - p.old_y) + ay*DELTA_TIME*DELTA_TIME;

            p.old_x = tx;
            p.old_y = ty;
        }
    }
};

/**
 * Solves constraints before rendering (brings two points closer or futher apart based 
 * on their resting distance.
 */
Cloth.prototype.solveConstraints = function () {

    // We solve the constraint multiple times before rendering to avoid 'jitteryness'.
    for (var j = 0; j < CONSTRAINT_ITERATIONS; j++) {
        for (var x = 0; x < this.constraints.length; x++) {
            var x1 = this.constraints[x].pA.x;
            var y1 = this.constraints[x].pA.y;
            var x2 = this.constraints[x].pB.x;
            var y2 = this.constraints[x].pB.y;

            var dx = x2 - x1;
            var dy = y2 - y1;

            var dlen = approxDist(dx, dy);
            var diff = (dlen - this.constraints[x].restLength)/dlen;

            this.constraints[x].pA.x += dx*0.5*diff;
            this.constraints[x].pA.y += dy*0.5*diff;
            this.constraints[x].pB.x -= dx*0.5*diff;
            this.constraints[x].pB.y -= dy*0.5*diff;
        }

        // Reset each anchor point to its appropriate position.
        this.anchors.forEach(function(p) {
            p.x = p.anchorx;
            p.y = p.anchory;
        });
    }
};

/**
 * Draw the cloth (point masses and constraints).
 */
Cloth.prototype.draw = function (canvas) {
    /* Don't draw the dots.
    for (var i = 0; i < this.width; i++) {
        for (var j = 0; j < this.length; j++) {
            var p = this.particles[i][j];
            canvas.fillColor = p.color;
            canvas.beginPath();
            canvas.arc(p.x, p.y, p.size, 0, 2 * Math.PI, true);
            canvas.stroke();
        }
    }
    */
    for (var i = 0; i < this.constraints.length; i++) {
        canvas.beginPath();
        canvas.moveTo(this.constraints[i].pA.x, this.constraints[i].pA.y);
        canvas.lineTo(this.constraints[i].pB.x, this.constraints[i].pB.y);
        canvas.stroke();
    }
};

/**
 * Represents a particle (point mass). The size is only for display purposes, in reality,
 * point masses are effectively dimensionless.
 */
function Particle (pos, size) {
    this.ax = 0;
    this.ay = 0;

    this.anchored = false;
    this.anchorx = pos[0];
    this.anchory = pos[1];

    this.x = pos[0];
    this.y = pos[1];
    this.size = size;
    this.old_x = this.x;
    this.old_y = this.y;
};

/**
 * Gets the click location within the modified canvas (as 0,0 is at the bottom left).
 */
var getCanvasClickLoc = function (e, el) {
    var x;
    var y;
    if (e.pageX || e.pageY) { 
      x = e.pageX;
      y = e.pageY;
    }
    else { 
      x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft; 
      y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop; 
    } 
    x -= el.offsetLeft;
    y -= el.offsetTop;

    y = el.offsetHeight - y;
    return {x: x, y: y};
};

/**
 * Uses a numerical approximation to get the distance between two points (avoids Math.sqrt).
 */
var approxDist = function(dx, dy) {
    var min, max;

    if (dx < 0) dx = -dx;
    if (dy < 0) dy = -dy;

    if (dx < dy) {
        min = dx;
        max = dy;
    } else {
        min = dy;
        max = dx;
    }

    return (1007/1024)*max + (441/1024)*min;    
};

window.onload = function () {
    var canvas = document.getElementById('cn');
    var world = new World(canvas);
    world.start();
};