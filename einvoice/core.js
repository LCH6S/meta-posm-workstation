(function (root) {
  'use strict';
  const KEY = 'meta-pos-store-invoice-20261113-v1';
  const STORES = {
    sqb002: { id: 'sqb002', name: '悦投直连测试门店', device: 'POS-002-01', seller: '悦投服饰（上海）有限公司', sellerTaxNo: '91310000DEMO000001' },
    sqb003: { id: 'sqb003', name: '悦投服饰静安店', device: 'POS-003-01', seller: '悦投服饰（上海）有限公司', sellerTaxNo: '91310000DEMO000001' }
  };
  const PRODUCTS = [
    { id: 'clothes', name: '服装', category: '服装', spec: '', unit: '件', default: true, rate: 0.13 },
    { id: 'shoes', name: '鞋子', category: '鞋', spec: '', unit: '双', rate: 0.13 },
    { id: 'accessory', name: '服饰配件', category: '配件', spec: '', unit: '件', rate: 0.13 },
    { id: 'bag', name: '箱包', category: '箱包', spec: '', unit: '个', rate: 0.13 }
  ];
  const date = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const textLength = value => Array.from(String(value ?? '')).length;
  const limitText = (value,max) => Array.from(String(value ?? '')).slice(0,max).join('');
  const total = o => o.items.reduce((s, i) => s + i.cents, 0);
  const money = n => (n / 100).toFixed(2);
  let cache;
  const normalize = db => { for (const [id,store] of Object.entries(db.storeCatalog||{})) STORES[id]=store; for (const o of db.orders) { if (!String(o.number??'').trim()) o.number=o.id; for (const i of o.items) if (i.quantity == null) i.quantity = 1; } return db; };
  const read = () => { try { return normalize(JSON.parse(localStorage.getItem(KEY)) || cache || seed()); } catch { return normalize(cache || seed()); } };
  const write = db => { cache = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} root.dispatchEvent(new Event('invoice-data')); return db; };
  // Pending fixtures deliberately omit dueAt; external review can explicitly issue them.
  function processingSamples(now = Date.now(), today = date()) {
    const purchaser = { type: 'company', title: '上海悦行科技有限公司', taxId: '91310000MA1DEMO001', email: 'finance@example.com' };
    return [
      [{ product: 'clothes', cents: 26800, quantity: 2 }],
      [{ product: 'shoes', cents: 39800, quantity: 1 }, { product: 'accessory', cents: 20000, quantity: 2 }],
      [{ product: 'bag', cents: 128000, quantity: 1 }]
    ].map((items, index) => ({ id: 'KPPROCESSING00' + (index + 1), number: 'XS20261115P00' + (index + 1), date: today, note: '', store: 'sqb002', device: 'POS-002-01', rev: 1, createdAt: now - (index + 1) * 60000, updatedAt: now - (index + 1) * 30000, cancelled: false, items, application: { ...purchaser, submittedAt: now - (index + 1) * 30000 }, invoice: null, refund: null, log: [{ text: '消费者已提交开票申请', at: now - (index + 1) * 30000 }] }));
  }
  function seed() {
    const now = Date.now(), today = date();
    const make = (id, number, cents, extra = {}) => ({ id, number, date: today, note: '', store: 'sqb002', device: 'POS-002-01', rev: 1, createdAt: now - 600000, updatedAt: now - 600000, cancelled: false, items: [{ product: 'clothes', cents }], application: null, invoice: null, refund: null, log: [{ text: '订单已创建', at: now - 600000 }], ...extra });
    const purchaser = { type: 'company', title: '上海悦行科技有限公司', taxId: '91310000MA1DEMO001', email: 'finance@example.com' };
    const orders = [
      make('KP202611130006', 'XS202611130006', 128000, { createdAt: now - 50000 }),
      make('KP202611130005', 'XS202611130005', 89900, { items: [{ product: 'clothes', cents: 59900 }, { product: 'accessory', cents: 30000 }], application: { ...purchaser, submittedAt: now - 120000 }, invoice: { number: '26000000000000000005', issuedAt: now - 90000 } }),
      make('KP202611130004', 'XS202611130004', 36000, { cancelled: true, cancelledAt: now - 200000, application: { ...purchaser, submittedAt: now - 300000 }, invoice: { number: '26000000000000000004', issuedAt: now - 280000 }, refund: { status: 'success', completedAt: now - 195000 } }),
      make('KP202611130003', '', 25900, { cancelled: true, cancelledAt: now - 300000 }),
      make('KP202611130002', 'OTHER20261113', 56900, { store: 'sqb003', device: 'POS-003-01' }),
      make('KP202611130001', 'LOCALOTHERDEVICE', 15900, { device: 'POS-002-02' })
    ];
    return { version: 1, sequence: 6, orders: [...processingSamples(now, today), ...orders], samplePacks: ['processing-v1'], lastCreated: orders[0].id };
  }
  function commit(fn) { const db = read(); const value = fn(db); write(db); return value; }
  function log(o, text) { o.log.unshift({ text, at: Date.now() }); }
  const order = id => read().orders.find(o => o.id === id);
  function validate(input) {
    if (textLength(String(input.number??'').trim()) > 36) throw new Error('订单编号最多36个字符');
    if (String(input.number??'').trim() && !/^[A-Za-z0-9]+$/.test(String(input.number).trim())) throw new Error('订单编号仅支持英文字母和数字');
    if (textLength(input.note) > 200) throw new Error('订单备注最多200个字符');
    if (!input.items.length) throw new Error('请选择至少一个开票项目');
    if (input.items.some(i => !PRODUCTS.some(p => p.id === i.product))) throw new Error('开票项目已更新，请重新选择开票项目');
    if (input.items.some(i => !Number.isSafeInteger(i.cents) || i.cents <= 0)) throw new Error('每个项目的金额须大于 0，最多保留两位小数');
    if (input.items.some(i => !Number.isFinite(i.quantity) || i.quantity <= 0)) throw new Error('每个项目的数量须大于 0');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(new Date(input.date + 'T00:00:00').getTime())) throw new Error('请选择有效的订单日期');
    if (input.date > date()) throw new Error('订单日期不能晚于今天');
    if (total(input) > 10000000000) throw new Error('订单金额超出本次演示支持范围');
  }
  function save(input, id, expectedRev) {
    if(read().demoSettings?.manualInvoiceEnabled===false)throw new Error('功能未开通');
    validate(input);
    return commit(db => {
      const now = Date.now();
      const active=STORES.sqb002;
      db.storeCatalog ||= {};db.storeCatalog[active.id]=active;
      db.projectCatalog ||= {};
      input.items=input.items.map(i=>{const snapshot={...PRODUCTS.find(p=>p.id===i.product)};db.projectCatalog[i.product]=snapshot;return {...i,snapshot};});
      if (id) {
        const o = db.orders.find(x => x.id === id);
        if (!o || o.cancelled || o.application || o.rev !== expectedRev) throw new Error('订单状态已变化，无法修改，请查看最新订单');
        Object.assign(o, input, { number:String(input.number||'').trim()||o.id, rev: o.rev + 1, updatedAt: now }); log(o, '订单已修改，生成新开票二维码');
        db.lastCreated = id; return o;
      }
      let generated;do{db.sequence++;generated='KP'+date().replaceAll('-', '')+String(db.sequence).padStart(4, '0');}while(db.orders.some(o=>o.id===generated||o.number===generated));
      const o = { ...input, number:String(input.number||'').trim()||generated, id: generated, store: active.id, device: active.device, rev: 1, createdAt: now, updatedAt: now, cancelled: false, application: null, invoice: null, refund: null, log: [{ text: '订单已创建', at: now }] };
      db.orders.unshift(o); db.lastCreated = o.id; return o;
    });
  }
  function apply(id, rev, purchaser) {
    if (!purchaser.title.trim()) throw new Error('请填写发票抬头');
    if (purchaser.type === 'company' && !/^[A-Z0-9]{15,20}$/i.test(purchaser.taxId.trim())) throw new Error('请填写有效的纳税人识别号');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaser.email)) throw new Error('请填写有效的接收邮箱');
    return commit(db => {
      const o = db.orders.find(x => x.id === id);
      if (!o || o.cancelled) throw new Error('订单已取消，无法申请开票');
      if (o.rev !== Number(rev)) throw new Error('二维码已更新，请向门店获取新二维码');
      if (o.application) throw new Error('该订单已提交申请，请勿重复申请');
      o.application = { ...purchaser, submittedAt: Date.now(), dueAt: Date.now() + 6500 };
      log(o, '消费者已提交开票申请'); return o;
    });
  }
  function cancel(id) {
    if(read().demoSettings?.manualInvoiceEnabled===false)throw new Error('功能未开通');
    return commit(db => {
      const o = db.orders.find(x => x.id === id);
      if (!o) throw new Error('订单不存在');
      if (o.cancelled) return o;
      if (o.application && !o.invoice) throw new Error('正在开票，暂不能撤销，请先查询开票结果');
      o.cancelled = true; o.cancelledAt = Date.now(); log(o, '订单已撤销，开票二维码失效');
      if (o.invoice) { o.refund = { status: 'processing', dueAt: Date.now() + 4500 }; log(o, '关联发票全额红冲中'); }
      return o;
    });
  }
  function resend(id, email) {
    if(read().demoSettings?.manualInvoiceEnabled===false)throw new Error('功能未开通');
    const recipient = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('请填写有效的接收邮箱');
    return commit(db => {
      const o = db.orders.find(x => x.id === id);
      if (!o || !o.invoice || o.cancelled || o.refund) throw new Error('当前订单状态不支持重新发送');
      if (!o.deliveries) o.deliveries = [];
      o.deliveries.push({ email: recipient, invoiceNumber: o.invoice.number, submittedAt: Date.now(), status: 'submitted' });
      return o;
    });
  }
  function tick(now = Date.now()) {
    const db = read(); let changed = false;
    for (const o of db.orders) {
      if (o.application?.dueAt <= now && !o.invoice) {
        o.invoice = { number: '26' + String(o.application.submittedAt).padStart(18, '0'), issuedAt: now };
        log(o, '发票已开具'); changed = true;
        if (o.cancelled) { o.refund = { status: 'processing', dueAt: now + 4500 }; log(o, '取消后出票成功，系统自动全额红冲'); }
      }
      if (o.refund?.status === 'processing' && o.refund.dueAt <= now) {
        o.refund.status = 'success'; o.refund.completedAt = now; log(o, '关联发票全额红冲成功'); changed = true;
      }
    }
    if (changed) write(db);
  }
  function invoiceStatus(o) { return o.refund?.status === 'success' ? '已全额红冲' : o.refund?.status === 'failed' ? '红冲失败' : o.refund ? '红冲中' : o.invoice ? '已开票' : o.application ? '开票中' : '未申请开票'; }
  root.DemoCore = { KEY, STORES, PRODUCTS, projects:()=>PRODUCTS, getProject:id=>PRODUCTS.find(p=>p.id===id)||read().projectCatalog?.[id]||{id,name:"开票项目",unit:"件",spec:"",rate:0.13}, activeStore:()=>STORES.sqb002, manualAvailable:()=>read().demoSettings?.manualInvoiceEnabled!==false, entryVisible:()=>read().demoSettings?.invoiceEntryVisible!==false, setDemoSettings:values=>commit(db=>{db.demoSettings={...db.demoSettings,...values};}), date, money, total, textLength, limitText, read, write, seed, order, save, apply, cancel, resend, tick, invoiceStatus };
  const initial = read();
  if (!initial.samplePacks?.includes('processing-v1')) {
    for (const sample of processingSamples()) if (!initial.orders.some(o => o.id === sample.id)) initial.orders.push(sample);
    initial.samplePacks = [...(initial.samplePacks || []), 'processing-v1'];
    write(initial);
  } else if (!localStorage.getItem(KEY)) write(initial);
})(window);
