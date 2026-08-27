import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
  token?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };

    req.userId = decoded.userId;
    req.token = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
        req.userId = decoded.userId;
      }
    }

    next();
  } catch (error) {
    // Ignore auth errors in optional middleware
    next();
  }
}
