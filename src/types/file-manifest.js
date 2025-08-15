// File manifest types and enums

export const EditType = {
  UPDATE_COMPONENT: 'UPDATE_COMPONENT',
  ADD_FEATURE: 'ADD_FEATURE', 
  FIX_ISSUE: 'FIX_ISSUE',
  UPDATE_STYLE: 'UPDATE_STYLE',
  REFACTOR: 'REFACTOR',
  FULL_REBUILD: 'FULL_REBUILD',
  ADD_DEPENDENCY: 'ADD_DEPENDENCY'
};

export const EditIntent = {
  TARGETED: 'TARGETED',
  COMPREHENSIVE: 'COMPREHENSIVE'
};

export class FileManifest {
  constructor() {
    this.files = {};
    this.entryPoint = null;
    this.components = [];
    this.dependencies = [];
    this.styles = [];
  }

  addFile(path, content, metadata = {}) {
    this.files[path] = {
      content,
      ...metadata
    };
  }

  setEntryPoint(path) {
    this.entryPoint = path;
  }

  addComponent(path, componentInfo) {
    this.components.push({ path, ...componentInfo });
  }

  addDependency(name, version) {
    this.dependencies.push({ name, version });
  }

  addStyle(path) {
    this.styles.push(path);
  }
}
