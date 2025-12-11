import { Router, Request, Response } from 'express';

const router: Router = Router();

router.get('/users', (req: Request, res: Response) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:4200');
    res.send('Get all users');
});

export default router;