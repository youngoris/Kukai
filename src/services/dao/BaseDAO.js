import databaseService from '../DatabaseService';

export class BaseDAO {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async create(data) {
    return await databaseService.create(this.tableName, data);
  }

  async read(id) {
    return await databaseService.read(this.tableName, id);
  }

  async update(id, data) {
    return await databaseService.update(this.tableName, id, data);
  }

  async delete(id) {
    return await databaseService.delete(this.tableName, id);
  }

  async query(sql, params = []) {
    return await databaseService.query(sql, params);
  }

  async findAll() {
    return await databaseService.query(`SELECT * FROM ${this.tableName}`);
  }

  async findByIds(ids) {
    if (!ids || !ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return await databaseService.query(
      `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders})`,
      ids
    );
  }

  async count() {
    const result = await databaseService.query(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    return result[0]?.count || 0;
  }
} 