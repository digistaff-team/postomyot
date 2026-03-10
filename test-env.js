require('dotenv').config();
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('KIE_API_KEY:', process.env.KIE_API_KEY ? process.env.KIE_API_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.substring(0, 20) + '...' : 'NOT SET');
