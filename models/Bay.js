// Bay Model - Data structure for bay entity

class Bay {
  constructor(id, name, status = 'active', description = '', capacity = 0) {
    this.id = id;
    this.name = name;
    this.status = status;
    this.description = description;
    this.capacity = capacity;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  // Update bay information
  update(data) {
    Object.keys(data).forEach(key => {
      if (this.hasOwnProperty(key) && key !== 'id') {
        this[key] = data[key];
      }
    });
    this.updatedAt = new Date();
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      description: this.description,
      capacity: this.capacity,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Bay;
