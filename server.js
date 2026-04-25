const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const FACE_API_KEY = process.env.FACE_API_KEY;
const FACE_API_SECRET = process.env.FACE_API_SECRET;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
// 存邀请码的状态，格式如 { 'INV_A1B2C': { status: 'unused' } }
const inviteDatabase = {}; 

// ==========================================
// 核心2：管理员专属 - 生成单次邀请链接
// ==========================================
app.get('/api/admin/generate-link', (req, res) => {
    // 校验管理员密码
    if (req.query.secret !== ADMIN_SECRET) {
        return res.status(401).send('无权访问！密码错误。');
    }

    // 生成一个随机的 8 位大写邀请码
    const code = 'INV_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // 存入数据库，状态为“未使用”
    inviteDatabase[code] = { status: 'unused' };

    const frontEndUrl = process.env.FRONTEND_URL || 'https://你的github网页地址';
    const shareLink = `${frontEndUrl}?code=${code}`;
    // const frontEndUrl = 'http://127.0.0.1:5500/my-face-app2/frontend/index.html';
    // const shareLink = `${frontEndUrl}?code=${code}`;

    // 返回生成结果
    res.json({
        message: '生成成功！请把下面的链接复制发给朋友',
        inviteCode: code,
        shareLink: shareLink
    });
});

// ==========================================
// 核心3：修改颜值检测接口，增加邀请码核销
// ==========================================
app.post('/api/face-detect', async (req, res) => {
    try {
        const { image_base64, inviteCode } = req.body;

        // 🛡️ 防火墙：校验邀请码是否有效且未使用
        const inviteRecord = inviteDatabase[inviteCode];
        if (!inviteRecord) {
            return res.status(403).json({ error: '无效的邀请链接！请向管理员索要专属链接。' });
        }
        if (inviteRecord.status === 'used') {
            return res.status(403).json({ error: '该链接已被使用过，每条链接仅限测算一次！' });
        }

        // 验证通过，请求旷视 API
        const params = new URLSearchParams();
        params.append('api_key', FACE_API_KEY);
        params.append('api_secret', FACE_API_SECRET);
        params.append('image_base64', image_base64);
        params.append('return_attributes', 'beauty,age,gender,emotion,facequality');

        const faceRes = await axios.post('https://api-cn.faceplusplus.com/facepp/v3/detect', params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        // 测算成功后，🔥 立刻核销作废该邀请码
        inviteDatabase[inviteCode].status = 'used';

        res.json(faceRes.data);

    } catch (error) {
        console.error("后端请求报错:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: '接口调用失败', details: error.message });
    }
});

app.listen(3000, () => {
    console.log('防白嫖服务器运行在 http://localhost:3000');
});