var GRAVITY = -5;
var DELTA_TIME = 0.2;
var CONSTRAINT_ITERATIONS = 5;
var REST_LENGTH = 14;

var offset_x = 50;
var offset_y = 200;

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

function World (canvasEl) {
    var ctx = canvasEl.getContext('2d');
    ctx.lineWidth = 0.2;

    this.el = canvasEl;
    this.ctx = ctx;
    this.width = ctx.canvas.width;
    this.height = ctx.canvas.height;
    this.ctx.translate(0, this.ctx.canvas.height);
    this.ctx.scale(1, -1);

    this.cloth = new Cloth([offset_x, offset_y], 35, 15, canvasEl);
}

World.prototype.start = function () {
    var frame = window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame;
    var frameWrapper = function(){
        this.render();
        frame(frameWrapper);
    }.bind(this);
    frameWrapper();
};

World.prototype.render = function () {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.cloth.applyVerlet();
    this.cloth.solveConstraints();
    this.cloth.draw(this.ctx);
};

function Cloth (pos, x, y, canvasEl) {
    this.el = canvasEl;
    this.particles = [];
    this.constraints = [];
    this.anchors = [];

    for (var i = 0; i < x; i++) {
        var arr = [];
        for (var j = 0; j < y; j++) {
            var par = new Particle([
                pos[0] + i*REST_LENGTH,
                pos[1] + j*REST_LENGTH], 1.5);
            arr.push(par);
        }
        this.particles.push(arr);
    }

    this.length = y;
    this.width = x;

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

    this.setupPhysics();

    this.el.onclick = function (evt) {
        var pos = getCanvasClickLoc(evt, this.el);
        var closest = this.particles[0][0];
        var closestDist = 10000;
        this.particles.forEach(function(pArr) {
            pArr.forEach(function(p) {
                var dist = Math.sqrt((p.x-pos.x)*(p.x-pos.x) + (p.y-pos.y)*(p.y-pos.y));
                if (dist < closestDist) {
                    closest = p;
                    closestDist = dist;
                }
            });
        });
        closest.anchorx = pos.x;
        closest.anchory = pos.y;
        this.anchors.push(closest);
    }.bind(this);
}

Cloth.prototype.setupPhysics = function () {
    for (var i = 0; i < this.width; i++) {
        for (var j = 0; j < this.length; j++) {
           this.particles[i][j].ay = GRAVITY;
        }
    }

    this.anchors.push(this.particles[0][this.length-1]);
    this.anchors.push(this.particles[this.width-1][this.length-1]);
};

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

Cloth.prototype.solveConstraints = function () {
    for (var j = 0; j < CONSTRAINT_ITERATIONS; j++) {
        for (var x = 0; x < this.constraints.length; x++) {
            var x1 = this.constraints[x].pA.x;
            var y1 = this.constraints[x].pA.y;
            var x2 = this.constraints[x].pB.x;
            var y2 = this.constraints[x].pB.y;

            var dx = x2 - x1;
            var dy = y2 - y1;

            var d = dx*dx + dy*dy;
            var dlen = Math.sqrt(d);
            var diff = (dlen - this.constraints[x].restLength)/dlen;

            this.constraints[x].pA.x += dx*0.5*diff;
            this.constraints[x].pA.y += dy*0.5*diff;
            this.constraints[x].pB.x -= dx*0.5*diff;
            this.constraints[x].pB.y -= dy*0.5*diff;
        }

        this.anchors.forEach(function(p) {
            p.x = p.anchorx;
            p.y = p.anchory;
        });
    }
};

Cloth.prototype.draw = function (canvas) {
    for (var i = 0; i < this.width; i++) {
        for (var j = 0; j < this.length; j++) {
            var p = this.particles[i][j];
            canvas.fillColor = p.color;
            canvas.beginPath();
            canvas.arc(p.x, p.y, p.size, 0, 2 * Math.PI, true);
            canvas.stroke();
        }
    }

    for (var i = 0; i < this.width-1; i++) {
        canvas.beginPath();
        canvas.moveTo(this.particles[i+1][this.length-1].x, this.particles[i+1][this.length-1].y);
        canvas.lineTo(this.particles[i][this.length-1].x, this.particles[i][this.length-1].y);
        canvas.stroke();

        for (var j = 0; j < this.length-1; j++) {
            canvas.beginPath();
            canvas.moveTo(this.particles[i+1][j].x, this.particles[i+1][j].y);
            canvas.lineTo(this.particles[i][j].x, this.particles[i][j].y);
            
            canvas.moveTo(this.particles[i][j+1].x, this.particles[i][j+1].y);
            canvas.lineTo(this.particles[i][j].x, this.particles[i][j].y);
            canvas.stroke();
        }
    }

    for (var j = 0; j < this.length-1; j++) {
        canvas.beginPath();
        canvas.moveTo(this.particles[this.width-1][j+1].x, this.particles[this.width-1][j+1].y);
        canvas.lineTo(this.particles[this.width-1][j].x, this.particles[this.width-1][j].y);
        canvas.stroke();
    }
};

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

