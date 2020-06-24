class ThreeDModelLoaderPreview {
  /**
   * 3D Preview of model
   * @class H5PEditor.ThreeDModelLoaderPreview
   */
  constructor(callbacks = {}) {
    this.callbacks = callbacks || {};
    this.callbacks.onIframeComplete = callbacks.onIframeComplete || (() => {});

    this.iframe = this.buildIframe();
  }

  /**
   * Get scene DOM.
   * @return {HTMLElement} Scene DOM.
   */
  getDOM() {
    return this.iframe;
  }

  /**
   * Build iframe.
   * @param {HTMLElement} iframe.
   */
  buildIframe() {
    const iframe = document.createElement('iframe');
    iframe.classList.add('h5p-editor-3d-model-loader-preview-iframe');

    iframe.addEventListener('load', () => {
      if (this.iframeLoaded) {
        return;
      }

      // Will write the iframe contents
      this.handleIframeLoaded(this.iframe);
      this.iframeLoaded = true;
    });

    return iframe;
  }

  /**
   * Handle iframe loaded.
   * @param {HTMLElement} iframe Iframe.
   */
  handleIframeLoaded(iframe) {
    try {
      const iframeWindow = iframe.contentWindow;

      // Write iframe contents
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(this.buildHTML().outerHTML);
      iframe.contentWindow.document.close();

      this.iframeDocument = iframe.contentDocument ? iframe.contentDocument: iframeWindow;

      this.handleIframeComplete();
    }
    catch (error) {
      console.warn(error);
    }
  }

  /**
   * Build HTML for iframe.
   * @return {HTMLElement}
   */
  buildHTML() {
    const html = document.createElement('html');
    html.appendChild(this.buildHeader());
    html.appendChild(this.buildBody());

    return html;
  }

  /**
   * Build Header.
   * @return {HTMLElement} Header.
   */
  buildHeader() {
    const head = document.createElement('head');

    // There must be a way to build the style dynamically from H5P libraries

    // Load AFrame script
    const scriptAFrame = document.createElement('script');
    scriptAFrame.text = H5P.AFrame.toString();
    head.appendChild(scriptAFrame);

    const scriptAFrameOrbitControls = document.createElement('script');
    scriptAFrameOrbitControls.text = H5P.AFrameOrbitControls.toString();
    head.appendChild(scriptAFrameOrbitControls);

    // Start scripts
    const scriptStarter = document.createElement('script');
    scriptStarter.text  = 'H5PAFrame();';
    scriptStarter.text += 'H5PAFrameOrbitControls();';
    head.appendChild(scriptStarter);

    return head;
  }

  /**
   * Build body.
   * @return {HTMLElement} Body.
   */
  buildBody() {
    const body = document.createElement('body');
    body.style.background = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TtVIqDnYQcQhSnSxIFXHUKhShQqgVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi5Oik6CIl/i8ptIj14Lgf7+497t4BQr3MNKtrAtB020wl4mImuyoGXtGDEIKIYURmljEnSUl0HF/38PH1LsqzOp/7c/SpOYsBPpF4lhmmTbxBPL1pG5z3icOsKKvE58TjJl2Q+JHrisdvnAsuCzwzbKZT88RhYrHQxkobs6KpEU8RR1RNp3wh47HKeYuzVq6y5j35C0M5fWWZ6zSHkcAiliBBhIIqSijDRpRWnRQLKdqPd/APuX6JXAq5SmDkWEAFGmTXD/4Hv7u18pMxLykUB7pfHOdjFAjsAo2a43wfO07jBPA/A1d6y1+pAzOfpNdaWuQI6N8GLq5bmrIHXO4Ag0+GbMqu5Kcp5PPA+xl9UxYYuAWCa15vzX2cPgBp6ip5AxwcAmMFyl7v8O7e9t7+PdPs7weB03KtCTN/SAAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+QGDAsAMkAVB00AAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAPklEQVRIx2M8ceIEAynA1NSUJPVMDDQGoxaMWjBqwagFoxZQAzD+/fuXJA2k1h+jcTBqwagFoxaMWjAkLAAAEQ8IhUX6aEEAAAAASUVORK5CYII=")';
    body.style.margin = '0';
    body.style.overflow = 'hidden';
    body.style.padding = '0';
    body.style.height = '144px';
    body.style.width = '256px';

    body.appendChild(this.buildScene());

    return body;
  }

  /**
   * Build Scene.
   * @return {HTMLElement} Scene.
   */
  buildScene() {
    // Scene
    const scene = document.createElement('a-scene');
    scene.setAttribute('embedded', '');
    scene.setAttribute('vr-mode-ui', 'false');

    // Model
    const entityModel = document.createElement('a-entity');
    const model = document.createElement('a-gltf-model');
    model.setAttribute('id', 'model');
    entityModel.appendChild(model);
    scene.appendChild(entityModel);

    // Plane
    const markerPlane = document.createElement('a-plane');
    markerPlane.setAttribute('id', 'markerPlane');
    markerPlane.setAttribute('position', `${ThreeDModelLoaderPreview.DEFAULT_OFFSET.x} ${ThreeDModelLoaderPreview.DEFAULT_OFFSET.y} ${ThreeDModelLoaderPreview.DEFAULT_OFFSET.z}`);
    markerPlane.setAttribute('rotation', '-90 0 0');
    markerPlane.setAttribute('width', '1');
    markerPlane.setAttribute('height', '1');
    markerPlane.setAttribute('src', ThreeDModelLoaderPreview.DEFAULT_TEXTURE);
    markerPlane.setAttribute('shadow', '');

    scene.appendChild(markerPlane);

    // Camera
    const entityCamera = document.createElement('a-entity');
    entityCamera.setAttribute('camera', '');
    entityCamera.setAttribute('look-controls', '');
    entityCamera.setAttribute('orbit-controls', 'initialPosition: 0 0 2; enableKeys: false;');
    scene.appendChild(entityCamera);

    return scene;
  }

  /**
   * Handle iframe complete. Depends on load timing.
   */
  handleIframeComplete() {
    if (this.iframeDocument.readyState !== 'complete') {
      this.iframeDocument.addEventListener('readystatechange', () => {
        if (this.iframeDocument.readyState === 'complete') {

          this.model = this.iframeDocument.querySelector('#model');
          this.markerPlane = this.iframeDocument.querySelector('#markerPlane');

          this.isInitialized = true;
          this.callbacks.iframeComplete();
        }
      });
    }
    else {
      this.model = this.iframeDocument.querySelector('#model');
      this.markerPlane = this.iframeDocument.querySelector('#markerPlane');

      this.isInitialized = true;
      this.callbacks.onIframeComplete();
    }
  }

  /**
   * Show preview.
   */
  show() {
    this.iframe.classList.remove('h5peditor-3d-model-loader-display-none');
  }

  /**
   * Hide preview.
   */
  hide() {
    this.iframe.classList.add('h5peditor-3d-model-loader-display-none');
  }

  /**
   * Set marker texture. If no src parameter, remove texure.
   * @param {string} [src] Base64 encoded image source path.
   */
  setMarkerTexture(src = ThreeDModelLoaderPreview.DEFAULT_TEXTURE) {
    if (!this.isInitialized) {
      return; // Not ready
    }

    this.markerPlane.setAttribute('src', src);
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

    // Set model
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
