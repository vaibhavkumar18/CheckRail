import { verifyToken } from "../utils/jwt.js";
import User from "../features/users/user.model.js";
export const authenticateUser = async (req, res, next) => {
  try {
    // 1. Read JWT from HttpOnly cookie
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    // 2. Verify JWT signature and expiry
    let decoded;

    try {
      decoded = await verifyToken(token);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    // 3. Fetch the latest user data from the database
    const result = await User.findById(decoded.id);
    if (!result) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }


    const user = result;

    // 4. Ensure the user still exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    // 5. Reject inactive accounts
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated.",
      });
    }

    // 6. Attach trusted database data to the request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};
