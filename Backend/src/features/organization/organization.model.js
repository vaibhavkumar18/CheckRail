import DB from "../../config/DB.js";

const Organization = {
  // 1. Create an organization
  async createOrganization(name, ownerId) {
  const client = await DB.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO organizations (name, owner_id)
        VALUES ($1, $2)
        RETURNING *;
      `,
      [name, ownerId]
    );

    const organization = result.rows[0];

    await client.query(
      `
        INSERT INTO organization_members (
          organization_id,
          user_id,
          role
        )
        VALUES ($1, $2, 'ADMIN')
        ON CONFLICT (organization_id, user_id)
        DO NOTHING;
      `,
      [organization.id, ownerId]
    );

    await client.query("COMMIT");

    return organization;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
},

async getOrganizationsByUserId(userId) {
  const query = `
    SELECT DISTINCT
      o.id,
      o.name,
      o.owner_id,
      o.created_at,
      o.updated_at,
      CASE
        WHEN o.owner_id = $1 THEN 'ADMIN'
        ELSE om.role
      END AS user_role
    FROM organizations o
    LEFT JOIN organization_members om
      ON om.organization_id = o.id
      AND om.user_id = $1
    WHERE
      o.owner_id = $1
      OR om.user_id = $1
    ORDER BY o.created_at DESC;
  `;

  const result = await DB.query(query, [userId]);

  return result.rows;
},

  // 3. Get organization by ID
  async getOrganizationById(organizationId, userId = null) {
  const query = `
    SELECT
      o.id,
      o.name,
      o.owner_id,
      o.created_at,
      o.updated_at,
      CASE
        WHEN o.owner_id = $2 THEN 'ADMIN'
        ELSE om.role
      END AS user_role
    FROM organizations o
    LEFT JOIN organization_members om
      ON om.organization_id = o.id
      AND om.user_id = $2
    WHERE o.id = $1
      AND (
        o.owner_id = $2
        OR om.user_id = $2
      )
    LIMIT 1;
  `;

  const result = await DB.query(query, [
    organizationId,
    userId,
  ]);

  return result.rows[0] ?? null;
},

  // 4. Update organization
  async updateOrganization(organizationId, userId, name) {
    const query = `
    UPDATE organizations o
    SET
      name = $3,
      updated_at = NOW()
    WHERE o.id = $1
      AND (
        o.owner_id = $2
        OR EXISTS (
          SELECT 1
          FROM organization_members om
          WHERE om.organization_id = o.id
            AND om.user_id = $2
            AND om.role = 'ADMIN'
        )
      )
    RETURNING o.*;
  `;

    const result = await DB.query(query, [organizationId, userId, name]);

    return result.rows[0] ?? null;
  },

  // 5. Delete organization
  async deleteOrganization(organizationId, userId) {
    const query = `
    DELETE FROM organizations o
    WHERE o.id = $1
      AND (
        o.owner_id = $2
        OR EXISTS (
          SELECT 1
          FROM organization_members om
          WHERE om.organization_id = o.id
            AND om.user_id = $2
            AND om.role = 'ADMIN'
        )
      )
    RETURNING o.*;
  `;

    const result = await DB.query(query, [organizationId, userId]);

    return result.rows[0] ?? null;
  },

  // 6. Get organization members
  async getOrganizationMembers(organizationId) {
    const query = `
      SELECT
        om.id AS membership_id,
        om.organization_id,
        om.user_id,
        om.role,
        om.created_at,
        u.name AS name,
        u.email AS email
      FROM organization_members om
      INNER JOIN users u ON om.user_id = u.id
      WHERE om.organization_id = $1
      ORDER BY om.created_at DESC;
    `;

    const result = await DB.query(query, [organizationId]);

    return result.rows;
  },

  // 7. Create organization membership
  async createOrganizationMember(organizationId, userId, role, client = DB) {
    const query = `
    INSERT INTO organization_members (
      organization_id,
      user_id,
      role
    )
    VALUES ($1, $2, $3)
    RETURNING
      id AS membership_id,
      organization_id,
      user_id,
      role,
      created_at;
  `;

    const result = await client.query(query, [organizationId, userId, role]);

    return result.rows[0] ?? null;
  },
  async getMembershipByUserId(organizationId, userId) {
    const query = `
    SELECT
      id AS membership_id,
      organization_id,
      user_id,
      role
    FROM organization_members
    WHERE organization_id = $1
      AND user_id = $2
    LIMIT 1;
  `;

    const result = await DB.query(query, [organizationId, userId]);

    return result.rows[0] ?? null;
  },
  // 8. Update organization membership and user details
  async updateOrganizationMember(
    organizationId,
    membershipId,
    updates,
    client = DB,
  ) {
    const { name, email, role } = updates;

    // Find the membership and associated user
    const memberQuery = `
      SELECT user_id
      FROM organization_members
      WHERE organization_id = $1
        AND id = $2
      LIMIT 1;
    `;

    const memberResult = await client.query(memberQuery, [
      organizationId,
      membershipId,
    ]);

    if (memberResult.rows.length === 0) {
      return null;
    }

    const userId = memberResult.rows[0].user_id;

    // Update user details when supplied
    if (name !== undefined || email !== undefined) {
      const fields = [];
      const values = [];
      let index = 1;

      if (name !== undefined) {
        fields.push(`name = $${index++}`);
        values.push(name);
      }

      if (email !== undefined) {
        fields.push(`email = $${index++}`);
        values.push(email);
      }

      values.push(userId);

      const updateUserQuery = `
        UPDATE users
        SET ${fields.join(", ")},
            updated_at = NOW()
        WHERE id = $${index}
        RETURNING id;
      `;

      await client.query(updateUserQuery, values);
    }

    // Update the role in this organization only
    if (role !== undefined) {
      const updateRoleQuery = `
        UPDATE organization_members
        SET role = $1
        WHERE organization_id = $2
          AND id = $3
        RETURNING id;
      `;

      const roleResult = await client.query(updateRoleQuery, [
        role,
        organizationId,
        membershipId,
      ]);

      if (roleResult.rows.length === 0) {
        return null;
      }
    }

    // Return updated membership with user details
    const result = await client.query(
      `
        SELECT
          om.id AS membership_id,
          om.organization_id,
          om.user_id,
          om.role,
          om.created_at,
          u.name AS name,
          u.email AS email
        FROM organization_members om
        INNER JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = $1
          AND om.id = $2
        LIMIT 1;
      `,
      [organizationId, membershipId],
    );

    return result.rows[0] ?? null;
  },

  // 9. Delete organization membership, not the user account
  async deleteOrganizationMember(organizationId, membershipId, client = DB) {
    const query = `
      DELETE FROM organization_members
      WHERE organization_id = $1
        AND id = $2
      RETURNING
        id AS membership_id,
        organization_id,
        user_id,
        role;
    `;

    const result = await client.query(query, [organizationId, membershipId]);

    return result.rows[0] ?? null;
  },
  async getMembershipById(membershipId, organizationId) {
    const query = `
    SELECT
      om.id AS membership_id,
      om.organization_id,
      om.user_id,
      om.role,
      om.created_at,
      u.name,
      u.email
    FROM organization_members om
    INNER JOIN users u ON u.id = om.user_id
    WHERE om.id = $1
      AND om.organization_id = $2
    LIMIT 1;
  `;

    const result = await DB.query(query, [membershipId, organizationId]);

    return result.rows[0] ?? null;
  },
};

export default Organization;
