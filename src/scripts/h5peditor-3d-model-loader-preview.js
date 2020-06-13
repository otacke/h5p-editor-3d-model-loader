class ThreeDModelLoaderPreview {
  /**
   * TODO: Description
   * @class H5PEditor.ThreeDModelLoaderPreview
   */
  constructor() {
    if (!H5P.isAFrameRunning) {
      H5P.AFrame();
      H5P.AFrameOrbitControls();
      H5P.isAFrameRunning = true;
    }

    // Scene
    this.scene = document.createElement('a-scene');
    this.scene.setAttribute('embedded', '');
    this.scene.setAttribute('vr-mode-ui', 'false');

    // Assets
    const assets = document.createElement('a-assets');
    this.markerTexture = document.createElement('img');
    this.markerTexture.setAttribute('id', 'foo123'); // TODO: Unique IDs
    this.markerTexture.src = ThreeDModelLoaderPreview.DEFAULT_TEXTURE;
    assets.appendChild(this.markerTexture);

    this.scene.appendChild(assets);

    // Model
    const entityModel = document.createElement('a-entity');
    this.model = document.createElement('a-gltf-model');
    entityModel.appendChild(this.model);
    this.scene.appendChild(entityModel);

    // Plane
    this.markerPlane = document.createElement('a-plane');
    this.markerPlane.setAttribute('position', `${ThreeDModelLoaderPreview.DEFAULT_OFFSET.x} ${ThreeDModelLoaderPreview.DEFAULT_OFFSET.y} ${ThreeDModelLoaderPreview.DEFAULT_OFFSET.z}`);
    this.markerPlane.setAttribute('rotation', '-90 0 0');
    this.markerPlane.setAttribute('width', '1');
    this.markerPlane.setAttribute('height', '1');
    this.markerPlane.setAttribute('src', '#foo123');
    this.markerPlane.setAttribute('shadow', '');
    this.scene.appendChild(this.markerPlane);

    // Camera
    const entityCamera = document.createElement('a-entity');
    entityCamera.setAttribute('camera', '');
    entityCamera.setAttribute('look-controls', '');
    entityCamera.setAttribute('orbit-controls', 'initialPosition: 0 0 2; enableKeys: false;');
    this.scene.appendChild(entityCamera);

    this.previewWrapper = document.createElement('div');
    this.previewWrapper.classList.add('h5peditor-3d-model-loader-preview-wrapper');
    this.previewWrapper.classList.add('h5peditor-3d-model-loader-display-none');
    this.previewWrapper.appendChild(this.scene);
  }

  /**
   * Get scene DOM.
   * @return {HTMLElement} Scene DOM.
   */
  getDOM() {
    // TODO: Check for better solution, Orbit Controls sets this
    setTimeout(() => {
      document.body.style.cursor = 'unset';
    }, 500);

    this.isInitialized = true;
    return this.previewWrapper;
  }

  /**
   * Show preview.
   */
  show() {
    this.previewWrapper.classList.remove('h5peditor-3d-model-loader-display-none');
  }

  /**
   * Hide preview.
   */
  hide() {
    this.previewWrapper.classList.add('h5peditor-3d-model-loader-display-none');
  }

  /**
   * Set marker texture. If no src parameter, remove texure.
   * @param {string} [src] Base64 encoded image source path.
   */
  setMarkerTexture(src = ThreeDModelLoaderPreview.DEFAULT_TEXTURE) {
    if (!this.isInitialized) {
      return; // Not ready
    }

    // Set texture
    this.markerTexture.onload = () => {
      this.markerPlane.getObject3D('mesh').material.map = new window.THREE.TextureLoader().load( this.markerTexture.src );
    };
    this.markerTexture.src = src;
  }

  /**
   * Set model.
   * @param {string} path Object file path.
   * @param {object} params Parameters.
   */
  setModel(path, params) {
    if (!this.isInitialized) {
      return;
    }

    if (!path) {
      this.model.setAttribute('visible', false);
      return;
    }

    // Get potential cross-origin source
    const element = document.createElement('div');
    H5P.setSource(element, {path:path}, H5PEditor.contentId);
    const src = element.src;

    if (!src) {
      return;
    }

    // set model
    this.model.setAttribute('gltf-model', src);

    // Set geometry
    if (params && params.scale) {
      this.setModelScale(params.scale);
    }

    if (params && params.position) {
      this.setModelPosition(params.position);
    }

    if (params && params.rotation) {
      this.setModelRotation(params.rotation);
    }

    this.model.setAttribute('visible', true);
  }

  /**
   * Set model scale.
   * @param {number} scale Scale relative to original model scale.
   */
  setModelScale(scale) {
    if (!this.isInitialized || !scale) {
      return;
    }

    scale = Math.max(0.01, scale);

    this.model.setAttribute('scale', `${scale} ${scale} ${scale}`);
  }

  /**
   * Set model position.
   * @param {object} coordinates Coordinates relative to marker.
   * @param {number} coordinates.x X coordinate.
   * @param {number} coordinates.y Y coordinate.
   * @param {number} coordinates.z Z coordinate.
   */
  setModelPosition(coordinates) {
    if (!this.isInitialized || !coordinates) {
      return;
    }

    const x = coordinates.x + ThreeDModelLoaderPreview.DEFAULT_OFFSET.x;
    const y = coordinates.y + ThreeDModelLoaderPreview.DEFAULT_OFFSET.y;
    const z = coordinates.z + ThreeDModelLoaderPreview.DEFAULT_OFFSET.z;

    this.model.setAttribute('position', `${x} ${y} ${z}`);
  }

  /**
   * Set model rotation.
   * @param {object} angles Angles relative to marker.
   * @param {number} angles.x X angle.
   * @param {number} angles.y Y angle.
   * @param {number} angles.z Z angle.
   */
  setModelRotation(angles) {
    if (!this.isInitialized || !angles) {
      return;
    }

    this.model.setAttribute('rotation', `${angles.x} ${angles.y} ${angles.z}`);
  }
}

// Default offset
ThreeDModelLoaderPreview.DEFAULT_OFFSET = {x: 0, y: -1, z: 0};

// White texture
ThreeDModelLoaderPreview.DEFAULT_TEXTURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAABhWlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9btSoVBzOIOGSogmBBVMRRq1CECqFWaNXB5NIPoUlDkuLiKLgWHPxYrDq4OOvq4CoIgh8gTo5Oii5S4v+SQosYD4778e7e4+4dEKyVmGa1jQGabpupRFzMZFfE8Cs6EIGAEXTJzDJmJSkJ3/F1jwBf72I8y//cn6NHzVkMCIjEM8wwbeJ14qlN2+C8TyywoqwSnxOPmnRB4keuKx6/cS64HOSZgplOzRELxGKhhZUWZkVTI54kjqqaTvnBjMcq5y3OWqnCGvfkL4zk9OUlrtMcRAILWIQEEQoq2EAJNmK06qRYSNF+3Mc/4Polcink2gAjxzzK0CC7fvA/+N2tlZ8Y95IicaD9xXE+hoDwLlCvOs73sePUT4DQM3ClN/3lGjD9SXq1qUWPgN5t4OK6qSl7wOUO0P9kyKbsSiGawXweeD+jb8oCfbdA96rXW2Mfpw9AmrpK3gAHh8BwgbLXfN7d2drbv2ca/f0ARjFylR0Z2fIAAAAJcEhZcwAALiMAAC4jAXilP3YAAAAHdElNRQfkBgwUKTdjQ4hkAAAAGXRFWHRDb21tZW50AENyZWF0ZWQgd2l0aCBHSU1QV4EOFwAAAAxJREFUCNdj+P//PwAF/gL+3MxZ5wAAAABJRU5ErkJggg==';

export default ThreeDModelLoaderPreview;
