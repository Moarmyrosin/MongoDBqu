// End-to-end verification of the 8 new requirements from the docx.
// Self-contained: boots the app in-process on an ephemeral port.
import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import mongoose from 'mongoose';

await connectDB();
const server = app.listen(0);
const port = server.address().port;
const BASE = `http://localhost:${port}/api`;

let failures = 0;

function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}  ${extra}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const uniq = Date.now().toString(36);

async function main() {
  // --- register two users ---
  const a = await req('POST', '/auth/register', { body: { username: `a_${uniq}`, password: 'password123' } });
  const b = await req('POST', '/auth/register', { body: { username: `b_${uniq}`, password: 'password123' } });
  const tokenA = a.data?.token || a.data?.data?.token;
  const tokenB = b.data?.token || b.data?.data?.token;
  const userA = a.data?.user || a.data?.data?.user;
  const userB = b.data?.user || b.data?.data?.user;
  check('register A', tokenA, JSON.stringify(a.data));
  check('register B', tokenB, JSON.stringify(b.data));

  console.log('\n== R1: save question for reuse / use in new survey / one question many surveys ==');
  const q = await req('POST', '/questions', { token: tokenA, body: { content: { title: '你喜欢的颜色', type: 'radio', required: true, options: [{ label: '红', value: 'red' }, { label: '蓝', value: 'blue' }, { label: '绿', value: 'green' }] } } });
  const qId = q.data?._id || q.data?.data?._id;
  check('create library question', qId, JSON.stringify(q.data));

  const s1 = await req('POST', '/surveys', { token: tokenA, body: { title: '问卷1' } });
  const s1Id = s1.data?._id || s1.data?.data?._id;
  check('create survey 1', s1Id, JSON.stringify(s1.data));

  const add1 = await req('POST', `/surveys/${s1Id}/questions`, { token: tokenA, body: { fromQuestionId: qId } });
  check('add library q to survey1 (snapshot)', add1.status === 200 || add1.status === 201, JSON.stringify(add1.data));

  const s2 = await req('POST', '/surveys', { token: tokenA, body: { title: '问卷2' } });
  const s2Id = s2.data?._id || s2.data?.data?._id;
  await req('POST', `/surveys/${s2Id}/questions`, { token: tokenA, body: { fromQuestionId: qId } });
  const usage1 = await req('GET', `/questions/${qId}/usage`, { token: tokenA });
  check('usage shows 2 surveys (R6)', (usage1.data?.data?.totalSurveys) === 2, JSON.stringify(usage1.data));

  console.log('\n== R2: share question to another user ==');
  const share = await req('PATCH', `/questions/${qId}/share`, { token: tokenA, body: { addUsernames: [`b_${uniq}`] } });
  check('share to B', share.status === 200, JSON.stringify(share.data));
  const sharedList = await req('GET', '/questions/shared', { token: tokenB });
  const sharedItems = sharedList.data?.items || sharedList.data?.data?.items || [];
  check('B sees shared question', sharedItems.some((x) => String(x._id) === String(qId)), JSON.stringify(sharedList.data));

  const sb = await req('POST', '/surveys', { token: tokenB, body: { title: 'B的问卷' } });
  const sbId = sb.data?._id || sb.data?.data?._id;
  const addB = await req('POST', `/surveys/${sbId}/questions`, { token: tokenB, body: { fromQuestionId: qId } });
  check('B uses shared q in own survey', addB.status === 200 || addB.status === 201, JSON.stringify(addB.data));

  console.log('\n== R3: modify q must NOT affect published survey ==');
  await req('POST', `/surveys/${s1Id}/publish`, { token: tokenA });
  const before = await req('GET', `/surveys/${s1Id}`, { token: tokenA });
  const beforeTitle = before.data?.questions?.[0]?.title || before.data?.data?.questions?.[0]?.title;
  // modify library question (branch new version)
  const upd = await req('PATCH', `/questions/${qId}`, { token: tokenA, body: { content: { title: '你喜欢的颜色（新）', type: 'radio', options: [{ label: '红', value: 'red' }, { label: '蓝', value: 'blue' }] }, createNewVersion: true } });
  const newQId = upd.data?._id || upd.data?.data?._id;
  check('update branches new version', newQId && String(newQId) !== String(qId), JSON.stringify(upd.data));
  const after = await req('GET', `/surveys/${s1Id}`, { token: tokenA });
  const afterTitle = after.data?.questions?.[0]?.title || after.data?.data?.questions?.[0]?.title;
  check('published survey title unchanged', beforeTitle === afterTitle, `before=${beforeTitle} after=${afterTitle}`);

  console.log('\n== R4: record modification history / restore ==');
  const hist = await req('GET', `/questions/${newQId}/versions`, { token: tokenA });
  const versions = hist.data?.versions || hist.data?.data?.versions || [];
  check('version history has >= 2', versions.length >= 2, JSON.stringify(hist.data));
  const restore = await req('POST', `/questions/${newQId}/restore`, { token: tokenA, body: { versionId: qId } });
  const restored = restore.data?._id || restore.data?.data?._id;
  check('restore creates new version from old', restored && String(restored) !== String(newQId), JSON.stringify(restore.data));

  console.log('\n== R5: multiple versions coexist / different surveys use different versions ==');
  const s3 = await req('POST', '/surveys', { token: tokenA, body: { title: '问卷3' } });
  const s3Id = s3.data?._id || s3.data?.data?._id;
  // add the NEW version to survey3
  const addNew = await req('POST', `/surveys/${s3Id}/questions`, { token: tokenA, body: { fromQuestionId: newQId } });
  check('survey3 uses new version', addNew.status === 200 || addNew.status === 201, JSON.stringify(addNew.data));
  const s3get = await req('GET', `/surveys/${s3Id}`, { token: tokenA });
  const s3q = s3get.data?.questions?.[0] || s3get.data?.data?.questions?.[0];
  const s1get2 = await req('GET', `/surveys/${s1Id}`, { token: tokenA });
  const s1q = s1get2.data?.questions?.[0] || s1get2.data?.data?.questions?.[0];
  check('survey1 uses v1, survey3 uses v2', (s1q?.sourceVersion ?? s1q?.sourceQuestionId) && (s3q?.sourceQuestionId) && String(s1q.sourceQuestionId) !== String(s3q.sourceQuestionId), `s1=${JSON.stringify(s1q)} s3=${JSON.stringify(s3q)}`);

  console.log('\n== R7: question bank ==');
  const bank = await req('POST', '/banks', { token: tokenA, body: { name: '常用题库' } });
  const bankId = bank.data?._id || bank.data?.data?._id;
  check('create bank', bankId, JSON.stringify(bank.data));
  const addBank = await req('POST', `/banks/${bankId}/questions`, { token: tokenA, body: { questionId: newQId } });
  check('add question to bank', addBank.status === 200, JSON.stringify(addBank.data));
  const bankQs = await req('GET', `/banks/${bankId}/questions`, { token: tokenA });
  const bankItems = bankQs.data?.items || bankQs.data?.data?.items || [];
  check('bank lists question', bankItems.some((x) => String(x._id) === String(newQId)), JSON.stringify(bankQs.data));
  const remBank = await req('DELETE', `/banks/${bankId}/questions/${newQId}`, { token: tokenA });
  check('remove question from bank', remBank.status === 200, JSON.stringify(remBank.data));

  console.log('\n== R8: cross-survey statistics for a single question ==');
  // submit responses to survey1 (v1) and survey3 (v2)
  const form1 = await req('GET', `/surveys/${s1Id}/form`, { token: tokenA });
  const q1Inst = form1.data?.data?.survey?.questions?.[0];
  const resp1 = await req('POST', `/surveys/${s1Id}/responses`, { token: tokenA, body: { answers: [{ questionId: q1Inst?._id, value: 'red' }] } });
  check('submit response to survey1', resp1.status === 200 || resp1.status === 201, JSON.stringify(resp1.data));
  await req('POST', `/surveys/${s3Id}/publish`, { token: tokenA });
  const form3 = await req('GET', `/surveys/${s3Id}/form`, { token: tokenA });
  const q3Inst = form3.data?.data?.survey?.questions?.[0];
  const resp3 = await req('POST', `/surveys/${s3Id}/responses`, { token: tokenA, body: { answers: [{ questionId: q3Inst?._id, value: 'blue' }] } });
  check('submit response to survey3', resp3.status === 200 || resp3.status === 201, JSON.stringify(resp3.data));

  const analytics = await req('GET', `/questions/${newQId}/analytics`, { token: tokenA, query: undefined });
  check('cross-survey analytics returns', analytics.status === 200, JSON.stringify(analytics.data));
  const stat = analytics.data?.stat || analytics.data?.data?.stat || {};
  check('cross-survey aggregates 2 responses', (stat.totalAnswers ?? stat.totalResponses ?? 0) >= 2, JSON.stringify(stat));

  console.log(`\n====================\n${failures === 0 ? 'ALL REQUIREMENTS PASS' : failures + ' FAILURE(S)'}\n====================`);
}

main()
  .then(() => shutdown(failures === 0 ? 0 : 1))
  .catch((e) => { console.error('ERROR', e); shutdown(2); });

function shutdown(code) {
  server.close(() => {
    mongoose.connection.close().finally(() => process.exit(code));
  });
}
