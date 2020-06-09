class ThreeDModelLoader {
  /**
   * Used to load additional GLTF resources
   * @class H5PEditor.ThreeDModelLoader
   *
   * @param {object} parent Parent object in semantics hierarchy.
   * @param {object} field Fields in semantics where widget is used.
   * @param {object} params Parameters of form.
   * @param {function} setValue Callback to update the form value.
   *
   * @throws {Error} No image found.
   */
  constructor(parent, field, params, setValue) {
    this.parent = parent;
    this.field = field;
    this.params = params;
    this.setValue = setValue;

    // Sanitize field parameters
    this.field.threeDModelLoader = this.field.threeDModelLoader || {};
    this.field.threeDModelLoader.fileTypeExtensions = this.field.threeDModelLoader.fileTypeExtensions || ['gltf', 'glb'];

    // Create the wrapper:
    this.$container = H5P.jQuery('<div>', {
      'class': 'field h5peditor-3d-model-loader-container'
    });

    const widgetName = this.field.type;
    this.fieldInstance = new H5PEditor.widgets[widgetName](parent, field, params, setValue);
    this.fieldInstance.appendTo(this.$container);

    // Errors
    this.$errors = this.$container.children().children('.h5p-errors');

    // Preview
    this.previewWrapper = document.createElement('div');
    this.previewWrapper.classList.add('h5peditor-3d-model-loader-preview-wrapper');
    this.$container.get(0).appendChild(this.previewWrapper);

    setTimeout(() => {
      this.buildDemoScene();
    }, 2000);

    this.parent.ready( () => {
      this.parent.children[1].children[0].on('changed', (event) => {
        if (this.foo) {
          this.foo.cube.scale.x = this.foo.scale.x * event.data.scale / 100;
          this.foo.cube.scale.y = this.foo.scale.y * event.data.scale / 100;
          this.foo.cube.scale.z = this.foo.scale.z * event.data.scale / 100;
          this.foo.renderer.render( this.foo.scene, this.foo.camera );
        }
      });

      this.parent.children[1].children[1].on('changed', (event) => {
        console.log(event.data);
        if (this.foo) {
          this.foo.cube.position.x = this.foo.position.x + event.data.x;
          this.foo.cube.position.y = this.foo.position.y + event.data.y;
          this.foo.cube.position.z = this.foo.position.z + event.data.z;
          this.foo.renderer.render( this.foo.scene, this.foo.camera );
        }
      });

      this.parent.children[1].children[2].on('changed', (event) => {
        console.log(event.data);
        if (this.foo) {
          this.foo.cube.rotation.x = this.foo.rotation.x + event.data.x / 360;
          this.foo.cube.rotation.y = this.foo.rotation.y + event.data.y / 360;
          this.foo.cube.rotation.z = this.foo.rotation.z + event.data.z / 360;
          this.foo.renderer.render( this.foo.scene, this.foo.camera );
        }
      });

    });

    // Changes
    this.changes = [];

    this.fileIcon = document.createElement('div');
    this.fileIcon.classList.add('h5peditor-3d-model-loader-file-icon');

    // Update icon on loadup
    H5PEditor.followField(this.parent, this.field.name, (event) => {
      if (!event || !event.path) {
        return;
      }

      // Only gltf supported
      const extension = event.path.split('.').slice(-1)[0].toLowerCase();
      if (this.field.threeDModelLoader.fileTypeExtensions.indexOf(extension) === -1) {
        return;
      }

      this.showFileIcon(extension);
    });

    this.fieldInstance.on('fileUploaded', (event) => {
      this.handleFileUploaded(event);
    });
  }

  buildDemoScene() {
    var scene = new H5P.ThreeJS.Scene();
    var camera = new H5P.ThreeJS.PerspectiveCamera( 45, 256 / 144, 0.1, 1000 );

    var renderer = new H5P.ThreeJS.WebGLRenderer();
    renderer.setSize( 256, 144 );
    this.previewWrapper.appendChild( renderer.domElement );

    var geometry = new H5P.ThreeJS.BoxGeometry();
    var material = new H5P.ThreeJS.MeshBasicMaterial( { color: 0x00ff00 } );
    var cube = new H5P.ThreeJS.Mesh( geometry, material );
    scene.add( cube );

    camera.position.z = 5;

    renderer.render( scene, camera );

    this.foo = {
      renderer: renderer, scene: scene, camera: camera, cube: cube,
      scale: {x: cube.scale.x, y: cube.scale.y, z: cube.scale.z},
      position: {x: cube.position.x, y: cube.position.y, z: cube.position.z},
      rotation: {x: cube.rotation.x, y: cube.rotation.y, z: cube.rotation.z}
    };

    console.log(this.foo);
  }

  /**
   * Handle new file uploaded.
   * @param {Event} event Event.
   */
  handleFileUploaded(event) {
    const extension = event.data.path.split('#').slice(0, -1).join('#').split('.').slice(-1)[0].toLowerCase();

    // Only gltf supported
    if (this.field.threeDModelLoader.fileTypeExtensions.indexOf(extension) === -1) {
      this.$errors.append(H5PEditor.createError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'filetypeNotSupported')));
      this.removeFile();

      return;
    }

    /*
     * GLTF files are JSON files, but may not be in embedded format with base64
     * encoded textures or bin files. Would require to upload assets separately
     * and encode them. For now, only allow GLTF in embedded format and GLB.
     */
    if (extension === 'gltf') {
      // Get potential cross-origin source
      const element = document.createElement('div');
      H5P.setSource(element, event.data, H5PEditor.contentId);
      const src = element.src;

      // Try to parse JSON from file
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', src);
        xhr.onreadystatechange = () => {
          if (xhr.readyState !== 4) {
            return;
          }

          try {
            const json = JSON.parse(xhr.responseText);
            if (!this.isGLTFEmbeddedFormat(json)) {
              this.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'onlyEmbeddedAssets'));
              return;
            }
          }
          catch (error) {
            this.handleError(`${H5PEditor.t('H5PEditor.ThreeDModelLoader', 'fileDamaged')} (${error})`);
            return;
          }

          this.showFileIcon(extension);
        };
        xhr.send();
      }
      catch (error) {
        this.handleError(`${H5PEditor.t('H5PEditor.ThreeDModelLoader', 'fileDamaged')} (${error})`);
        return;
      }
    }

    this.showFileIcon(extension);
  }

  /**
   * Check JSON of GLTF file for being embedded format.
   * @param {object} json GLTF file as JSON object.
   * @return {boolean} True, if is embedded format, else false.
   */
  isGLTFEmbeddedFormat(json) {
    /**
     * Get objects with particular key (and value) from object.
     * @param {object} obj Object to search in.
     * @param {string} key Key to search for.
     * @param {string} val Value to search for.
     */
    const getObjects = (obj, key, val) => {
      let objects = [];
      for (var i in obj) {
        if (!obj.hasOwnProperty(i)) {
          continue;
        }

        if (typeof obj[i] == 'object') {
          objects = objects.concat(getObjects(obj[i], key, val));
        }
        else {
          if (i === key && obj[i] === val || i === key && val === '') {
            objects.push(obj);
          }
          else if (obj[i] === val && key === '') {
            if (objects.lastIndexOf(obj) === -1) {
              objects.push(obj);
            }
          }
        }
      }

      return objects;
    };

    const objects = getObjects(json, 'uri', '');
    const containsExternalReference = objects.some((obj) => {
      return obj.uri.substr(0, 5) !== 'data:';
    });

    return !containsExternalReference;
  }

  /**
   * Handle error.
   * @param {string} errorMessage Error message text.
   */
  handleError(errorMessage) {
    this.$errors.append(H5PEditor.createError(errorMessage));
    this.removeFile();
  }

  /**
   * Remove file from widget.
   */
  removeFile() {
    delete this.fieldInstance.params;
    this.fieldInstance.setValue(this.fieldInstance.field);
    this.fieldInstance.addFile();

    for (var i = 0; i < this.fieldInstance.changes.length; i++) {
      this.fieldInstance.changes[i]();
    }
  }

  /**
   * Show file pseudo icon.
   * @param {string} type File type.
   */
  showFileIcon(type) {
    // Wait for image. File.addFile() might not have completed yet
    const waitForImg = (timeout) => {
      timeout = timeout || 500;

      if (timeout <= 0) {
        return;
      }

      const img = this.fieldInstance.$file.find('img').get(0);
      if (img) {
        this.fileIcon.title = type;
        this.fileIcon.innerText = type;
        img.style.display = 'none';
        this.fieldInstance.$file.find('.thumbnail').get(0).appendChild(this.fileIcon);
      }
      else {
        setTimeout(() => {
          waitForImg(timeout - 20);
        }, 20);
      }
    };

    waitForImg();
  }

  /**
   * Append field to wrapper. Invoked by H5P core.
   * @param {H5P.jQuery} $wrapper Wrapper.
   */
  appendTo($wrapper) {
    this.$container.appendTo($wrapper);
  }

  /**
   * Validate current values. Invoked by H5P core.
   * @return {boolean} True, if current value is valid, else false.
   */
  validate() {
    return this.fieldInstance.validate();
  }

  /**
   * Remove self. Invoked by H5P core.
   */
  remove() {
    this.$container.remove();
  }
}
export default ThreeDModelLoader;
