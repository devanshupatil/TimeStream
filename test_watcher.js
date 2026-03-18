const Database = require('better-sqlite3');
const { extractSession } = require('/home/devanshu/TimeStream/src/importers/opencode.js');

const db = new Database('/home/devanshu/.local/share/opencode/opencode.db', { readonly: true });
const sess = db.prepare('SELECT * FROM session ORDER BY time_updated DESC LIMIT 1').get();

const messages = db.prepare('SELECT * FROM message WHERE session_id = ? ORDER BY time_created ASC').all(sess.id);
const finalMessages = [];

for (const msg of messages) {
    const msgMeta = JSON.parse(msg.data);
    const parts = db.prepare('SELECT * FROM part WHERE message_id = ? ORDER BY time_created ASC').all(msg.id);

    let content = '';
    for (const ptr of parts) {
        const ptData = JSON.parse(ptr.data);
        if (ptData.type === 'text' && ptData.text) {
            content += ptData.text + '\n\n';
        }
    }

    finalMessages.push({
        role: msgMeta.role,
        content: content.trim(),
        createdAt: new Date(msg.time_created).toISOString()
    });
}

const rawJson = {
    id: sess.id,
    title: sess.title,
    createdAt: new Date(sess.time_created).toISOString(),
    updatedAt: new Date(sess.time_updated).toISOString(),
    messages: finalMessages
};

const parsedSession = extractSession(rawJson, 'sqlite_db', sess.time_updated);
console.log(JSON.stringify(parsedSession, null, 2));
