class Mass {
  constructor(x, y) {
    this.position = createVector(x, y);
    // start with zero velocity
    this.velocity = createVector(0, 0);
    // when true the mass does not move (used for fixed objects)
    this.fixed = false;
    // collision radius (pixels) and physical mass (proportional to area)
    this.radius = 6;
    this.mass = this.radius * this.radius;
    this.fixed = false;
  }
  updatePosition() {
    if (this.fixed) return; // don't update fixed masses
    this.velocity.y += gravity;
    this.velocity.mult(damping);
    this.velocity.limit(maxVel);
    // integrate position
    this.position.x += this.velocity.x * deltaT;
    this.position.y += this.velocity.y * deltaT;
    // boundary collision using radius
    if (this.position.x < this.radius) {
      this.position.x = this.radius;
      this.velocity.x = 0;
      this.velocity.y *= friction;
    }
    if (this.position.x > width - this.radius) {
      this.position.x = width - this.radius;
      this.velocity.x = 0;
      this.velocity.y *= friction;
    }
    if (this.position.y < this.radius) {
      this.position.y = this.radius;
      this.velocity.y = 0;
      this.velocity.x *= friction;
    }
    if (this.position.y > height - this.radius) {
      this.position.y = height - this.radius;
      this.velocity.y = 0;
      this.velocity.x *= friction;
    }
  }
  display() {
    if (this.fixed) {
      fill(200, 50, 50);
      circle(this.position.x, this.position.y, this.radius * 2);
      // draw an outline to indicate fixed
      noFill();
      stroke(150, 30, 30);
      circle(this.position.x, this.position.y, this.radius * 3);
      stroke(0);
    } else {
      fill(0);
      circle(this.position.x, this.position.y, this.radius * 2);
    }
  }
}

class Spring {
  constructor(_m1, _m2) {
    this.m1 = _m1;
    this.m2 = _m2;
    this.restLength = dist(_m1.position.x, _m1.position.y,
      _m2.position.x, _m2.position.y);
  }
  applyConstraint() {
    if (this.m1.fixed && this.m2.fixed) return;

    let d = this.m2.position.copy();
    d.sub(this.m1.position);
    let distCurrent = d.mag();
    if (distCurrent === 0) return;

    // correction vector that should be removed from the current distance
    let correction = d.copy().mult((distCurrent - this.restLength) / distCurrent);

    if (this.m1.fixed) {
      // m1 fixed -> move m2 by the full correction toward m1
      this.m2.velocity.sub(correction.mult(stiffness));
    } else if (this.m2.fixed) {
      // m2 fixed -> move m1 by the full correction toward m2
      this.m1.velocity.add(correction.mult(stiffness));
    } else {
      // both movable -> split correction equally
      let half = correction.mult(0.5 * stiffness);
      this.m1.velocity.add(half);
      this.m2.velocity.sub(half);
    }
  }

  display() {
    line(this.m1.position.x, this.m1.position.y,
         this.m2.position.x, this.m2.position.y);
  }
}
