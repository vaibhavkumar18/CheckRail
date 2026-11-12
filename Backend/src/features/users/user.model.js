import DB from "../../config/DB.js";

const User = {
  // Create user
  async create({ name, email, passwordHash, role = "ADMIN" }) {
    const query = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, is_active, created_at
    `;

    const values = [name, email, passwordHash, role];
    const result = await DB.query(query, values);

    return result.rows[0];
  },

  // Find user by email
  async findByEmail(email) {
    const result = await DB.query(
      "SELECT * FROM users WHERE email = $1 LIMIT 1",
      [email],
    );

    return result.rows[0] ?? null;
  },
  async getUserByEmail(email) {
    const query = `
    SELECT id, name, email
    FROM users
    WHERE email = $1
      AND is_active = TRUE
    LIMIT 1;
  `;

    const result = await DB.query(query, [email]);

    return result.rows[0] ?? null;
  },

  // Find user by ID
  async findById(id) {
    const result = await DB.query(
      `SELECT id, name, email, role, organization_id, is_active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return result.rows[0] ?? null;
  },
};

export default User;
