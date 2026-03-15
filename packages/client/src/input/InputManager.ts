import * as THREE from 'three';

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseDown = false;
  private mouseClicked = false;
  private touchShootClicked = false;
  private mouseDx = 0;
  private mouseDy = 0;
  private pointerLocked = false;

  // Touch state
  private touchMoveId: number | null = null;
  private touchLookId: number | null = null;
  private touchMoveStart = { x: 0, y: 0 };
  private touchMoveVec = { x: 0, y: 0 };
  private touchLookDelta = { x: 0, y: 0 };
  private touchShootBtn = false;
  private touchJumpBtn = false;
  isTouchDevice = false;

  private _lastLookX: number | null = null;
  private _lastLookY: number | null = null;

  // Callbacks
  onToggleCamera: (() => void) | null = null;
  onToggleMute: (() => void) | null = null;

  constructor() {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyV') this.onToggleCamera?.();
      if (e.code === 'KeyM') this.onToggleMute?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Mouse
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDx += e.movementX;
        this.mouseDy += e.movementY;
      }
    });

    // Pointer lock state
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = !!document.pointerLockElement;
    });

    // Touch controls
    if (this.isTouchDevice) {
      this.setupTouchControls();
    }
  }

  private setupTouchControls(): void {
    // Create visible touch UI elements
    this.createTouchUI();

    // Look area = right side of canvas (not covered by buttons)
    const canvas = document.getElementById('game-canvas')!;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        // Only use canvas touches on the right half for look (if not on a button)
        const halfW = window.innerWidth / 2;
        if (touch.clientX > halfW) {
          this.touchLookId = touch.identifier;
          this._lastLookX = touch.clientX;
          this._lastLookY = touch.clientY;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.touchLookId) {
          this.touchLookDelta.x += touch.clientX - (this._lastLookX ?? touch.clientX);
          this.touchLookDelta.y += touch.clientY - (this._lastLookY ?? touch.clientY);
          this._lastLookX = touch.clientX;
          this._lastLookY = touch.clientY;
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.touchLookId) {
          this.touchLookId = null;
          this._lastLookX = null;
          this._lastLookY = null;
        }
      }
    }, { passive: false });
  }

  private createTouchUI(): void {
    const container = document.createElement('div');
    container.id = 'touch-controls';
    document.body.appendChild(container);

    // === LEFT JOYSTICK ===
    const joystickBase = document.createElement('div');
    joystickBase.id = 'joystick-base';
    container.appendChild(joystickBase);

    const joystickKnob = document.createElement('div');
    joystickKnob.id = 'joystick-knob';
    joystickBase.appendChild(joystickKnob);

    let joystickCenterX = 0;
    let joystickCenterY = 0;
    const maxRadius = 40;

    joystickBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.changedTouches[0];
      this.touchMoveId = touch.identifier;
      const rect = joystickBase.getBoundingClientRect();
      joystickCenterX = rect.left + rect.width / 2;
      joystickCenterY = rect.top + rect.height / 2;
      this.touchMoveVec = { x: 0, y: 0 };
    }, { passive: false });

    joystickBase.addEventListener('touchmove', (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.touchMoveId) {
          let dx = touch.clientX - joystickCenterX;
          let dy = touch.clientY - joystickCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
          }
          // Move the knob visually
          joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
          // Normalize to -1..1
          this.touchMoveVec = {
            x: dx / maxRadius,
            y: dy / maxRadius,
          };
        }
      }
    }, { passive: false });

    const resetJoystick = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.touchMoveId) {
          this.touchMoveId = null;
          this.touchMoveVec = { x: 0, y: 0 };
          joystickKnob.style.transform = 'translate(0px, 0px)';
        }
      }
    };
    joystickBase.addEventListener('touchend', resetJoystick, { passive: false });
    joystickBase.addEventListener('touchcancel', resetJoystick, { passive: false });

    // === FIRE BUTTON ===
    const fireBtn = document.createElement('div');
    fireBtn.id = 'btn-fire';
    fireBtn.textContent = 'FIRE';
    container.appendChild(fireBtn);

    fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.touchShootClicked = true;
      fireBtn.classList.add('active');
    }, { passive: false });
    fireBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fireBtn.classList.remove('active');
    }, { passive: false });
    fireBtn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      fireBtn.classList.remove('active');
    }, { passive: false });

    // === JUMP BUTTON ===
    const jumpBtn = document.createElement('div');
    jumpBtn.id = 'btn-jump';
    jumpBtn.textContent = 'JUMP';
    container.appendChild(jumpBtn);

    jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.touchJumpBtn = true;
      jumpBtn.classList.add('active');
    }, { passive: false });
    jumpBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.touchJumpBtn = false;
      jumpBtn.classList.remove('active');
    }, { passive: false });
    jumpBtn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.touchJumpBtn = false;
      jumpBtn.classList.remove('active');
    }, { passive: false });

    // === CAMERA TOGGLE BUTTON ===
    const camBtn = document.createElement('div');
    camBtn.id = 'btn-cam';
    camBtn.textContent = 'CAM';
    container.appendChild(camBtn);

    camBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onToggleCamera?.();
      camBtn.classList.add('active');
    }, { passive: false });
    camBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      camBtn.classList.remove('active');
    }, { passive: false });
  }

  showTouchControls(): void {
    const el = document.getElementById('touch-controls');
    if (el) el.style.display = 'block';
  }

  hideTouchControls(): void {
    const el = document.getElementById('touch-controls');
    if (el) el.style.display = 'none';
  }

  requestPointerLock(): void {
    if (!this.isTouchDevice) {
      document.body.requestPointerLock();
    }
  }

  getMovementVector(): THREE.Vector2 {
    if (this.isTouchDevice) {
      return new THREE.Vector2(this.touchMoveVec.x, this.touchMoveVec.y);
    }

    const vec = new THREE.Vector2(0, 0);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) vec.y = -1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) vec.y = 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) vec.x = -1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) vec.x = 1;
    if (vec.length() > 0) vec.normalize();
    return vec;
  }

  getMouseDelta(): { dx: number; dy: number } {
    if (this.isTouchDevice) {
      const delta = { dx: this.touchLookDelta.x * 6, dy: this.touchLookDelta.y * 6 };
      this.touchLookDelta = { x: 0, y: 0 };
      return delta;
    }

    const delta = { dx: this.mouseDx, dy: this.mouseDy };
    this.mouseDx = 0;
    this.mouseDy = 0;
    return delta;
  }

  isShooting(): boolean {
    if (this.isTouchDevice) {
      if (this.touchShootClicked) {
        this.touchShootClicked = false;
        return true;
      }
      return false;
    }
    if (this.mouseClicked) {
      this.mouseClicked = false;
      return true;
    }
    return false;
  }

  isJumping(): boolean {
    return this.keys.has('Space') || this.touchJumpBtn;
  }

  isTabHeld(): boolean {
    return this.keys.has('Tab');
  }

  isPointerLocked(): boolean {
    return this.pointerLocked || this.isTouchDevice;
  }
}
