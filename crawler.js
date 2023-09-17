import puppeteer from 'puppeteer-core';
import fs from 'fs';

// const login = async (page) => {
//   console.log(page.url())

//   const type = async (input, msg) => {
//     input.focus();
//     for (let i = 0; i < msg.length; i++) {
//       await input.type(msg[i]);
//     }
//   }

//   const ubtn = await page.$('.input-username-pc>.ant-input');
//   await type(ubtn, '220235194');
//   const pbtn = await page.$('.input-password-pc>.ant-input')
//   await type(pbtn, '015757');
//   const sbtn = await page.$('.login-button-pc');
//   sbtn.click();
// }

// 实验室安全网站 cookie
const cookies = [
  {
    url: 'http://safe.seu.edu.cn/',
    name: '.ASPXAUTH',
    value: '0E076B18DF9EEF82D21472BB100D2D1D97F1CAE5BC761BABE85C4DA2889B984363332CA7EE2128B07151F901E61444AF1A5BC11FD13FC3DDDD93ECF744F8FBF75E948C33609F4F606391C76B4CF8E472138E6DC04344EB23E1E5F0ADEC17CB8781C88910136988E60473CB57B4CAD98B3E8FF0FC315F2583D7137A4DF3671E6D0F4DFEA6D6A78269D679771ECBD41EFD562A40B478F517ECB117663266D91F79C95F46684421CD6C1C9968C527A4F3EB0042EDB3179D6C80B8686EC77986577E185009AB00D7F8D5652CDBF8DA6DFA91248BF59236313E969E2BC641A271DC25978D1CA6275C10C997FC271378C977C3'
  },
  {
    url: 'http://safe.seu.edu.cn/',
    name: 'ASP.NET_SessionId',
    value: '2xwvqxfb02oxj1ym1i5jpm4q'
  }
]

// 对获取到的题目字符串进行正则匹配，获取题目、答案信息
function dealQ (input) {
  const strMatch = input.match(/^(\d+)\.\s*\[(.*)\]\s*(.*)(?:参考答案:)\s*(.*)(?:解题分析：)(.*)/);
  let [_, index, type, qo, answer, explain] = strMatch;
  let question, options;
  // 对题目和选项处理
  if (type === '判断题') {
    question = qo;
    options = ['正确', '错误'];
  } else if (type === '单项选择题' || type === '多项选择题') {
    let qoMatch = qo.match(/(.*)A\.(.*)B\.(.*)C\.(.*)D\.(.*)E\.(.*)/);
    if (!qoMatch) qoMatch = qo.match(/(.*)A\.(.*)B\.(.*)C\.(.*)D\.(.*)/);
    if (!qoMatch) qoMatch = qo.match(/(.*)A\.(.*)B\.(.*)C\.(.*)/);
    if (!qoMatch) qoMatch = qo.match(/(.*)A\.(.*)B\.(.*)/);
    [_, question, ...options] = qoMatch;
    options.filter(item => !!item);
  }
  // 对答案进行处理
  answer = answer.split(',');
  const obj = {
    index,
    type,
    question,
    options,
    answer,
    explain
  };
  return obj;
}

// 爬取每一页数据，自动跳转下一页
const save = async (page, callback) => {
  await page.waitForSelector('iframe#fnode4');
  const frames = await page.frames();
  const frame = frames.find(f => f.name() === 'fnode4');
  // iframe 是否正确获取
  console.log(!!frame);
  const tools = await frame.$('#simplepagingtoolbar-1012-targetEl');
  const nextBtn = await tools.$('a[data-qtip=下一页]');
  const total = await tools.$eval('#tbtext-1018', el => Number.parseInt(el.textContent.match(/\d+/g) || '0'));
  let qfs = [];

  // 获取题目
  const parseQ = async () => {
    await frame.waitForSelector('table#gridview-1011-table');
    const qs = await frame.$$eval('table#gridview-1011-table tr span', el => el.map(item => {
      return item.textContent;
    }));
    const tmp = qs.map(item => dealQ(item));
    qfs = qfs.concat(tmp);
    await nextBtn.click();
  }

  // 爬取数据，每隔 1s 自动跳转下一页
  // 不设置间隔好像每页数据加载有问题，所以设置了一个等待时间（不会其他方法
  let cnt = 0;
  let timer = setInterval(async () => {
    if (cnt >= total && timer) {
      clearInterval(timer);
      fs.writeFileSync('data.json', JSON.stringify(qfs), {flag: 'w'});
      console.log('success');
      await callback();
      return;
    }
    await parseQ();
    cnt ++;
  }, 1000);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  let page = await browser.newPage();
  await page.setCookie(...cookies);
  await page.goto('http://safe.seu.edu.cn/LabSafetyExamSchoolSSO/AdminIndexSchool.aspx#/LabSafetyExamSchoolSSO/SchoolQuestionStudy.aspx');
  // await login();
  await save(page, browser.close);
})();