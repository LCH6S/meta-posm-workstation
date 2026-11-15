const { useState, useEffect, useMemo } = React;
const { Button, NavBar, FieldItem, Input, Icon, HotPopup, HotDatePicker, Search, dialog, toast } = window.MetaPOS;
const C = window.DemoCore;
const product = id => C.PRODUCTS.find(p => p.id === id);
const fmtTime = t => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(t);
const notify = message => toast.show({ message });
const go = path => { location.hash = path; window.scrollTo(0, 0); };
// QR carries order identity in this local Demo; production uses the existing consumer application entry.
const qrPayload = o => JSON.stringify({ scene: 'retail-invoice', orderId: o.id, revision: o.rev });
function glyph(name, size = 20) { return <Icon name={name} fontSize={size} />; }
function useData() {
  const [db, setDb] = useState(C.read);
  useEffect(() => {
    const update = () => setDb(C.read());
    window.addEventListener('storage', update); window.addEventListener('invoice-data', update);
    const timer = setInterval(() => C.tick(), 500);
    return () => { clearInterval(timer); window.removeEventListener('storage', update); window.removeEventListener('invoice-data', update); };
  }, []);
  return db;
}
function Nav({ title, back, right }) { return <div className="nav"><NavBar fixed={false} perch={false} onBack={back} right={right}>{title}</NavBar></div>; }
function Footer({ children }) { return <div className="footer">{children}</div>; }
function KV({ label, children }) { return <div className="kv"><dt>{label}</dt><dd>{children || '—'}</dd></div>; }
function Status({ o }) {
  const text = o.cancelled ? '已取消' : !o.application&&!o.invoice ? '未申请' : C.invoiceStatus(o);
  const color = o.cancelled ? 'muted' : o.refund?.status === 'failed' ? 'error' : o.invoice ? 'success' : o.application ? 'warn' : '';
  return <span className={'status ' + color}>{text}</span>;
}
function InvoiceRecordCard({o,detailPrefix='/order/'}) {
  return <button className="record invoice-record-card" onClick={()=>go(detailPrefix+o.id)}>
    <div className="row"><span className="identity">订单编号：{o.number || '—'}</span><span className="amount" aria-label={'开票金额 '+C.money(C.total(o))+'元'}>¥{C.money(C.total(o))}</span></div>
    <div className="row record-bottom"><span className="quiet">订单日期：{o.date}</span><Status o={o}/></div>
  </button>;
}
function QRImage({ order }) {
  const uri = useMemo(() => {
    const qr = qrcode(0, 'M'); qr.addData(qrPayload(order)); qr.make(); return qr.createDataURL(5, 4);
  }, [order.id, order.rev]);
  return <img className="qr-image" src={uri} alt="订单开票申请二维码" />;
}
function Home() {
  const unavailable = () => notify('请进入电子发票办理开票业务');
  return <div className="pos-home">
    <div className="pos-hero" role="img" aria-label="悦投直连测试门店，门店编号 sqb002"><div className="pos-pending-title">待处理订单</div></div>
    <div className="pos-empty">{glyph('bi-b-order', 44)}<div>暂无订单，点击刷新</div></div>
    <section className="pos-section"><h2>门店收银</h2><div className="pos-grid">
      {[['收款','bi-b-pay'],['退款','bi-c-after'],['账本','bi-b-list'],['结算','bi-financial-center'],['门店交易统计','bi-transaction-report']].map(([name, icon]) => <button className="pos-tile" onClick={unavailable} key={name}><span className="icon-tile">{glyph(icon, 28)}</span><span>{name}</span></button>)}
    </div></section>
    <section className="pos-section"><h2>应用功能</h2><div className="pos-grid">
      <button className="pos-tile" onClick={unavailable}><span className="icon-tile">{glyph('bi-c-wallet-fill', 28)}</span><span>礼品卡</span></button>
      <button className="pos-tile invoice-entry" onClick={() => go('/invoicing')}><span className="icon-tile">{glyph('bi-b-note', 28)}</span><span>电子发票</span></button>
    </div></section><div className="bottom-home" />
  </div>;
}
function InvoiceHome() {
  return <div className="screen"><Nav title="电子发票" back={() => go('/')}/><main className="invoice-home">
    <div className="invoice-entries">
      <a className="invoice-function-card" href="#/new">开票</a>
      <a className="invoice-function-card" href="#/refund">退票</a>
      <a className="invoice-function-card" href="#/orders">开票记录</a>
    </div>
  </main></div>;
}
function OrderCodeScanner({visible,onClose,onScan}) {
  const [error,setError]=useState('');
  const video=React.useRef(null),stream=React.useRef(null),timer=React.useRef(null),live=React.useRef(false),callback=React.useRef(onScan);
  callback.current=onScan;
  const stop=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;clearInterval(timer.current);};
  const deliver=raw=>{const code=String(raw??'').trim();if(!live.current||!code)return;live.current=false;stop();callback.current(code);};
  const close=()=>{live.current=false;stop();onClose();};
  useEffect(()=>{
    live.current=visible;setError('');if(!visible){stop();return;}
    let buffer='',last=0;
    const onResult=event=>{if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='invoice-scan-result')return;deliver(event.data.code);};
    const onKey=event=>{if(event.key==='Enter'&&buffer){event.preventDefault();deliver(buffer);buffer='';return;}if(event.key.length===1&&!event.ctrlKey&&!event.altKey&&!event.metaKey){const now=Date.now();if(now-last>150)buffer='';last=now;buffer=(buffer+event.key).slice(-2048);}};
    window.addEventListener('message',onResult);window.addEventListener('keydown',onKey,true);
    return()=>{live.current=false;stop();window.removeEventListener('message',onResult);window.removeEventListener('keydown',onKey,true);};
  },[visible]);
  const startCamera=async()=>{
    if(typeof window.BarcodeDetector!=='function'||!navigator.mediaDevices?.getUserMedia){setError('当前设备不支持摄像头识码，可使用扫码枪或手动输入订单号。');return;}
    try{stop();const detector=new BarcodeDetector({formats:['qr_code','code_128','ean_13']});const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});if(!live.current||!video.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;video.current.srcObject=media;await video.current.play();let running=false;timer.current=setInterval(async()=>{if(running||!live.current)return;running=true;try{const codes=await detector.detect(video.current);if(codes[0])deliver(codes[0].rawValue);}catch{}finally{running=false;}},500);}catch{if(live.current)setError('无法打开摄像头，请检查设备权限，或使用订单号查询。');}
  };
  return <HotPopup visible={visible} onClose={close}><div className="popup-title">扫描订单号<button className="icon-button" onClick={close}>关闭</button></div><div className="scanner-body"><div className="scanner-window"><video ref={video} muted playsInline/><Icon name="bi-b-scan"/></div><p>请扫描原消费订单的条码或二维码</p><p className="quiet">也可使用设备扫码枪输入订单号</p>{error&&<p className="inline-error" role="alert">{error}</p>}<Button onClick={startCamera}>启用摄像头扫码</Button><Button color="normal" onClick={close}>返回手动输入</Button></div></HotPopup>;
}

function RefundSearch({db}) {
  const [query,setQuery]=useState(''),[term,setTerm]=useState(null),[scan,setScan]=useState(false);
  const parse=raw=>{const text=String(raw||'').trim();try{const data=JSON.parse(text);if(data.orderId)return String(data.orderId);}catch{}const match=text.match(/#\/apply\/([^/]+)\//);return match?decodeURIComponent(match[1]):text;};
  const search=raw=>{const q=parse(raw);setQuery(q);setTerm(q);setScan(false);};
  const matches=term?db.orders.filter(o=>o.number===term||o.id===term):[];
  return <div className="screen"><Nav title="手动退票" back={()=>go('/invoicing')}/>
    <main><form className="refund-query" onSubmit={e=>{e.preventDefault();if(query.trim())search(query);}}>
      <div className="refund-input"><Icon name="bi-b-search"/><input aria-label="退票订单号" placeholder="请输入订单号" value={query} onChange={e=>{setQuery(e.target.value);setTerm(null);}} enterKeyHint="search"/><button type="button" aria-label="扫码输入订单号" onClick={()=>setScan(true)}><Icon name="bi-b-scan"/></button></div>
      <button type="submit" disabled={!query.trim()}>查询</button>
    </form>
    {term===null?<div className="query-help"><p>请输入订单编号查询已开票记录</p></div>:!matches.length?<div className="empty"><p>未找到相关订单</p><span className="quiet">请核对订单号后重新查询</span></div>:<div className="content"><div className="result-count">查询结果</div><div className="records refund-results">{matches.map(o=><InvoiceRecordCard key={o.id} o={o} detailPrefix="/refund-order/"/>)}</div></div>}
    </main>
    <OrderCodeScanner visible={scan} onClose={()=>setScan(false)} onScan={search}/>
  </div>;
}

function OrderList({ db }) {
  const [query, setQuery] = useState(''), [submitted, setSubmitted] = useState(''), [filter, setFilter] = useState('全部');
  const orders = db.orders.filter(o => submitted ? (o.number.includes(submitted) || o.id.includes(submitted)) : o.device === 'POS-002-01').filter(o => filter === '全部' || (filter === '未申请' && !o.cancelled && !o.application) || (filter === '开票中' && !o.cancelled && o.application && !o.invoice) || (filter === '已开票' && !o.cancelled && o.invoice));
  return <div className="screen">
    <Nav title="开票记录" back={() => go('/invoicing')} />

    <div className="search-area"><Search value={query} placeholder="输入订单编号查询" showSearchText={true} onChange={v => { setQuery(typeof v === 'string' ? v : ''); if (!v) setSubmitted(''); }} onSearch={v => setSubmitted(String(v || '').trim())} /></div>
    <div className="filter-tabs" role="tablist" aria-label="开票状态">{['全部','未申请','开票中','已开票'].map(t => <button role="tab" aria-selected={filter === t} className={filter === t ? 'active' : ''} key={t} onClick={() => setFilter(t)}>{t}</button>)}</div>
    <div className="records invoice-records">{orders.map(o=><InvoiceRecordCard key={o.id} o={o}/>)}</div>
    {!orders.length && <div className="empty">{glyph('bi-b-search',40)}<p>{submitted ? '未找到相关订单' : '暂无开票订单'}</p></div>}
  </div>;
}
const amountMessage=(value,optional=false)=>optional&&value===''?'':!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)<=0?'请输入大于0的金额，最多两位小数':'';
const quantityMessage=value=>!/^\d+(\.\d+)?$/.test(value)||!Number.isFinite(Number(value))||Number(value)<=0?'数量须大于0':'';
const numberMessage=value=>C.textLength(value.trim())>36?'订单编号最多36个字符':value.trim()&&!/^[A-Za-z0-9]+$/.test(value.trim())?'订单编号仅支持英文字母和数字':'';
const dateMessage=value=>!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(new Date(value+'T00:00:00').getTime())?'请选择有效的订单日期':value>C.date()?'订单日期不能晚于今天':'';
const noteMessage=value=>C.textLength(value)>200?'订单备注最多200个字符':'';
function OrderForm({ order, itemIndex=null }) {
  const [items, setItems] = useState(() => order ? order.items.map(i => ({ product: i.product, amount: C.money(i.cents), quantity: String(i.quantity ?? 1) })) : [{ product: C.PRODUCTS.find(p => p.default).id, amount: '', quantity: '1' }]);
  const [number, setNumber] = useState(order?.number || ''), [saleDate, setSaleDate] = useState(order?.date || C.date()), [note, setNote] = useState(order?.note || '');
  const [picker, setPicker] = useState(null), [dateVisible, setDateVisible] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [originalRev] = useState(order?.rev);
  const [numberScanner,setNumberScanner]=useState(false);
  const [attempted,setAttempted]=useState(false),[numberTouched,setNumberTouched]=useState(false),[noteTouched,setNoteTouched]=useState(false),[dateTouched,setDateTouched]=useState(false),[amountTouched,setAmountTouched]=useState({}),[editorAttempted,setEditorAttempted]=useState(false);
  const numberComposing=React.useRef(false),noteComposing=React.useRef(false);
  const changeNumber=v=>{setError('');setNumber(v);if(!numberComposing.current)setNumberTouched(true);};
  const changeNote=v=>{setNote(v);if(!noteComposing.current)setNoteTouched(true);};
  const numberError=error.includes('编号')?error:(numberTouched||attempted)&&!numberComposing.current?numberMessage(number):'';
  const noteError=(noteTouched||attempted)&&!noteComposing.current?noteMessage(note):'';
  const dateError=dateTouched||attempted?dateMessage(saleDate):'';
  const [editingItem,setEditingItem]=useState(null),[itemError,setItemError]=useState('');
  const formRoute=order?'/edit/'+order.id:'/new';
  useEffect(()=>{
    setEditorAttempted(false);
    if(itemIndex===null){setEditingItem(null);setItemError('');return;}
    if(!Number.isInteger(itemIndex)||!items[itemIndex]){go(formRoute);return;}
    setEditingItem(current=>current?.index===itemIndex?current:{index:itemIndex,...items[itemIndex]});setItemError('');
  },[itemIndex]);
  const closeItemEditor=()=>{setEditingItem(null);setItemError('');setEditorAttempted(false);go(formRoute);};
  const total = items.reduce((s, i) => s + (/^\d+(\.\d{0,2})?$/.test(i.amount) ? Math.round(Number(i.amount) * 100) : 0), 0);
  const updateAmount = (idx, amount) => { setError('');setAmountTouched(old=>({...old,[idx]:true})); setItems(old => old.map((i,k) => k === idx ? { ...i, amount } : i)); };
  const openItemEditor = idx => { setEditorAttempted(false);setItemError(''); setEditingItem({index:idx,...items[idx]});go(formRoute+'/item/'+idx); };
  const saveItemEditor = () => {
    setEditorAttempted(true);
    if (!/^\d+(\.\d+)?$/.test(editingItem.quantity) || !Number.isFinite(Number(editingItem.quantity)) || Number(editingItem.quantity)<=0) return setItemError('数量须大于 0');
    if (editingItem.amount!=='' && (!/^\d+(\.\d{1,2})?$/.test(editingItem.amount) || Number(editingItem.amount)<=0)) return setItemError('合计金额须大于 0，最多保留两位小数');
    setItems(old=>old.map((i,k)=>k===editingItem.index?{...i,quantity:editingItem.quantity,amount:editingItem.amount}:i));setError('');closeItemEditor();
  };
  const back = async () => {
    const changed = items.some(i => i.amount) || number || note;
    if (!changed || await dialog.confirm({ title: '放弃本次编辑？', content: '未保存的内容将丢失。', okText: '放弃编辑', cancelText: '继续编辑' })) go(order ? '/order/' + order.id : '/invoicing');
  };
  const save = () => {
    if (busy) return;
    setAttempted(true);setError('');
    if(numberMessage(number)||noteMessage(note)||dateMessage(saleDate))return;
    if (!items.length) return setError('请选择至少一个开票项目');
    if (items.some(i => !/^\d+(\.\d{1,2})?$/.test(i.amount) || Number(i.amount) <= 0)) return setError('请为每个开票项目填写大于 0 的金额，最多两位小数');
    if (items.some(i => !/^\d+(\.\d+)?$/.test(i.quantity) || !Number.isFinite(Number(i.quantity)) || Number(i.quantity) <= 0)) return setError('请为每个开票项目填写大于 0 的数量');
    setBusy(true);
    try {
      const saved = C.save({ items: items.map(i => ({ product: i.product, cents: Math.round(Number(i.amount) * 100), quantity: Number(i.quantity) })), number: number.trim(), date: saleDate, note: note.trim() }, order?.id, originalRev);
      go('/order/' + saved.id); notify(order ? '订单已修改，已生成新二维码' : '订单已创建');
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  };
  if(itemIndex!==null && editingItem) return <div className="screen item-editor-page"><Nav title="编辑开票项目" back={closeItemEditor}/><main className="content"><section className="section item-editor-body"><h2>{product(editingItem.product).name}</h2><FieldItem title={<label htmlFor="edit-item-quantity">数量</label>}><div className="quantity-unit-input"><input id="edit-item-quantity" className="meta-input" aria-label="编辑项目数量" inputMode="decimal" value={editingItem.quantity} onChange={e=>{setItemError('');setEditingItem({...editingItem,quantity:e.target.value});}}/><span className="item-unit">{product(editingItem.product).unit}</span></div></FieldItem>{editorAttempted&&quantityMessage(editingItem.quantity)&&<div className="field-error" role="alert">{quantityMessage(editingItem.quantity)}</div>}<FieldItem title={<label htmlFor="edit-item-total">合计金额</label>}><div className="quantity-unit-input"><input id="edit-item-total" className="meta-input" aria-label="编辑项目合计金额" inputMode="decimal" maxLength={12} placeholder="0.00" value={editingItem.amount} onChange={e=>{setItemError('');setEditingItem({...editingItem,amount:e.target.value});}}/><span className="item-unit">元</span></div></FieldItem>{editorAttempted&&amountMessage(editingItem.amount,true)&&<div className="field-error" role="alert">{amountMessage(editingItem.amount,true)}</div>}</section></main><Footer><Button color="outline" onClick={closeItemEditor}>取消</Button><Button onClick={saveItemEditor}>保存项目</Button></Footer></div>;
  return <div className="screen"><Nav title={order ? '修改订单' : '手动开票'} back={back}/>
    <main className="content">
      <section className="section flush"><div style={{padding:'16px 16px 0'}}><h2>开票项目</h2></div>
        {items.map((i, idx) => <div className="item-edit" key={idx}>
          <div className="item-header"><div className="item-summary"><strong>{product(i.product).name}</strong><span className="quantity-summary">{i.quantity} {product(i.product).unit}</span></div><div className="item-actions"><button type="button" className="edit-item-action" aria-label={'编辑第' + (idx + 1) + '个开票项目'} onClick={()=>openItemEditor(idx)}>编辑</button><button type="button" className="delete-item-action" aria-label={'删除第' + (idx + 1) + '个开票项目'} onClick={()=>{setItems(old=>old.filter((_,k)=>k!==idx));setAmountTouched({});setError('');}}>删除</button></div></div>
          {product(i.product).spec && <p className="item-meta">规格型号：{product(i.product).spec}</p>}
          <div className="item-price"><label htmlFor={'amount-' + idx}>项目总价</label><input id={'amount-' + idx} aria-label={'第' + (idx + 1) + '个项目总价'} value={i.amount} inputMode="decimal" placeholder="0.00" maxLength={12} onChange={e => updateAmount(idx,e.target.value)} onBlur={()=>setAmountTouched(old=>({...old,[idx]:true}))} aria-invalid={!!((attempted||amountTouched[idx])&&amountMessage(i.amount))} aria-describedby={(attempted||amountTouched[idx])&&amountMessage(i.amount)?'amount-error-'+idx:undefined} /></div>{(attempted||amountTouched[idx])&&amountMessage(i.amount)&&<div id={'amount-error-'+idx} className="field-error" role="alert">{amountMessage(i.amount)}</div>}{attempted&&quantityMessage(i.quantity)&&<div className="field-error" role="alert">{quantityMessage(i.quantity)}</div>}
        </div>)}
        <div className="add-item-row"><Button color="outline" className="add-item" onClick={() => setPicker('add')}>添加开票项目</Button></div>{attempted&&!items.length&&<div className="field-error project-empty-error" role="alert">请选择至少一个开票项目</div>}
      </section>
      <section className="section flush"><div style={{padding:'16px 16px 0'}}><h2>订单信息</h2></div><div className="field-group">
        <FieldItem title={<label htmlFor="order-number">订单编号</label>}><div className="order-number-input"><Input id="order-number" aria-invalid={!!numberError} aria-describedby={numberError?'number-error':undefined} onBlur={()=>setNumberTouched(true)} pattern="[A-Za-z0-9]*" spellCheck={false} autoCapitalize="off" value={number} onChange={changeNumber} onCompositionStart={()=>{numberComposing.current=true;}} onCompositionEnd={e=>{numberComposing.current=false;setNumber(e.currentTarget.value);setNumberTouched(true);}} placeholder="选填，留空自动分配" /><button type="button" className="number-scan-button" aria-label="扫码录入订单编号" onClick={()=>setNumberScanner(true)}><Icon name="bi-b-scan"/></button></div></FieldItem>{numberError&&<div id="number-error" className="field-error" role="alert">{numberError}</div>}
        <button className="date-control" onClick={() => setDateVisible(true)}><span>订单日期</span><span className="value">{saleDate}</span>{glyph('bi-b-calendar',18)}</button>{dateError&&<div className="field-error" role="alert">{dateError}</div>}
      </div><div className="field-helper">实际销售完成日期</div><div className="field-group"><FieldItem title={<label htmlFor="order-note">订单备注</label>}><textarea id="order-note" className="note-input" value={note} onChange={e => changeNote(e.target.value)} onCompositionStart={()=>{noteComposing.current=true;}} onCompositionEnd={e=>{noteComposing.current=false;setNote(e.currentTarget.value);setNoteTouched(true);}} placeholder="选填" rows={2} onBlur={()=>setNoteTouched(true)} aria-invalid={!!noteError} aria-describedby={noteError?'note-error':undefined} /></FieldItem>{noteError&&<div id="note-error" className="field-error" role="alert">{noteError}</div>}</div></section>
      {order && <p className="quiet">保存后将生成新的开票二维码，请重新交付给消费者。</p>}
    </main>
    <Footer><div className="total"><span className="quiet">合计</span><br/><strong className="amount">¥{C.money(total)}</strong></div><Button className="submit" disabled={busy} onClick={save}>{order ? '保存修改' : '确认创建'}</Button></Footer>
    <HotPopup visible={picker !== null} onClose={() => setPicker(null)} closeOnMaskClick={true} bodyStyle={{borderRadius:'20px 20px 0 0',overflow:'hidden'}}><div className="popup-body"><div className="popup-title">选择开票项目<button className="icon-button" aria-label="关闭项目选择" onClick={() => setPicker(null)}>{glyph('bi-b-close',20)}</button></div>{C.PRODUCTS.map(p => <button key={p.id} className="product-option" onClick={() => { setItems(old => picker === 'add' ? [...old, {product:p.id,amount:'',quantity:'1'}] : old.map((i,k) => k === picker ? {...i,product:p.id} : i)); setPicker(null); }}><span>{p.name}<p className="quiet">单位：{p.unit}</p></span>{glyph('bi-b-arrow-right',16)}</button>)}</div></HotPopup>

    <OrderCodeScanner visible={numberScanner} onClose={()=>setNumberScanner(false)} onScan={code=>{setNumberScanner(false);if(!/^[A-Za-z0-9]+$/.test(code)){setError('扫码订单编号仅支持英文字母和数字，请核对后录入');return;}if(C.textLength(code)>36){setError('扫码订单编号最多36个字符，请核对后录入');return;}setNumber(code);setError('');}}/>
    <HotDatePicker visible={dateVisible} value={new Date(saleDate + 'T12:00:00')} max={new Date()} title="订单日期" onClose={() => setDateVisible(false)} onConfirm={d => { setSaleDate(C.date(d));setDateTouched(true); setDateVisible(false); }}/>
  </div>;
}
function OrderNumberBarcode({number}) {
  const encoded=useMemo(()=>{try{const canvas=document.createElement('canvas');JsBarcode(canvas,number,{format:'CODE128',displayValue:false,width:2,height:64,margin:8,lineColor:'#000000',background:'#FFFFFF'});return canvas.toDataURL('image/png');}catch{return null;}},[number]);
  return encoded?<img className="order-number-barcode" src={encoded} alt="订单编号条码" data-order-number={number}/>:<p className="barcode-unavailable">此编号无法生成条码，请使用订单编号查询</p>;
}
function Receipt({ o }) {
  const amount=Number(C.money(C.total(o))).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return <div className="receipt invoice-receipt"><div className="receipt-brand"><img src="assets/receipt-logo.png" alt="收钱吧"/><div>shouqianba.com</div></div><div className="receipt-instructions"><p>请扫描下方二维码，开具电子发票</p><p className="receipt-english">Please scan QR code for e-invoice</p></div><div className="receipt-invoice-amount"><p>本次开票金额：¥{amount}</p><p className="receipt-english">Fapiao Amount: ¥{amount}</p></div><QRImage order={o}/><div className="dashed"/><div className="receipt-fields"><p>门店名称：{C.STORES[o.store].name}</p><p>门店编号：{o.store}</p><p>订单编号：{o.number}</p></div><OrderNumberBarcode number={o.number}/><div className="receipt-fields"><p>设备编号：{o.device}</p><p>订单日期：{o.date}</p></div><div className="receipt-support">收钱吧提供技术服务支持。</div></div>;
}
function ReceiptPage({ o }) {
  return <><div className="screen"><Nav title="二维码小票" back={() => go('/order/' + o.id)}/><div className="receipt-shell"><Receipt o={o}/></div><Footer><Button onClick={() => { document.querySelector('.print-visible').innerHTML = document.querySelector('.receipt-shell').innerHTML; window.print(); }}>打印</Button></Footer></div><div className="print-visible" style={{display:'none'}}/></>;
}
function OrderDetail({ o, origin }) {
  const unissued=!o.cancelled&&!o.application&&!o.invoice;
  const processing=!o.cancelled&&!!o.application&&!o.invoice;
  const canResend=!o.cancelled&&!!o.invoice&&!o.refund;
  const statusText=o.cancelled?'已取消':!o.application&&!o.invoice?'未开票':C.invoiceStatus(o);
  const revoke = async () => {
    const approved = await dialog.confirm({ title: o.invoice ? '确认整单退票？' : '撤销这笔订单？', content: o.invoice ? '整单退票后，关联发票将全额红冲，订单不可继续开票。' : '撤销后，顾客将无法使用此订单二维码申请开票。', okText: o.invoice ? '确认退票' : '确认撤销', cancelText: o.invoice ? '暂不退票' : '暂不撤销' });
    if (approved) { try { C.cancel(o.id); notify(o.invoice ? '已提交整单退票' : '订单已撤销'); } catch(e) { notify(e.message); } }
  };
  const queryResult = () => {
    C.tick();const latest=C.order(o.id);
    if(!latest)return notify('未找到这笔订单');
    notify(latest.invoice?'开票成功':latest.cancelled?'订单已撤销':'仍在开票中，请稍后查询');
  };
  return <div className="screen"><Nav title="订单开票详情" back={() => go(origin === 'refund' ? '/refund' : '/orders')} right={unissued?<button className="nav-revoke" onClick={revoke}>撤销</button>:null}/>
    <main className="content">
      <section className="section invoice-overview center">
        {!o.cancelled&&<div className="quiet">开票金额</div>}
        <div className="big-amount amount">¥{C.money(C.total(o))}</div>
        <div className={'overview-status '+(o.refund?.status==='failed'?'danger-text':'')}>{statusText}</div>
        {unissued&&<><QRImage order={o}/><p className="quiet">请顾客扫码申请开票</p></>}
      </section>
      {o.cancelled && (o.invoice||o.application) && o.refund?.status !== 'success' && <div className="hint">{o.refund?.status === 'failed' ? '关联发票红冲失败，请联系品牌财务处理。' : o.refund ? '关联发票正在全额红冲，请稍后查看结果。' : o.application && !o.invoice ? '系统正在处理关联开票申请。如后续出票成功，将自动全额红冲。' : '订单开票二维码已失效。'}</div>}
      <section className="section"><h2>订单信息</h2><dl className="kv-wrap"><KV label="订单编号">{o.number}</KV><KV label="订单日期">{o.date}</KV><KV label="订单备注">{o.note}</KV><KV label="开票门店">{C.STORES[o.store].name}</KV><KV label="创建时间">{fmtTime(o.createdAt)}</KV></dl></section>
      <section className="section"><h2>开票项目</h2>{o.items.map((i,k) => <div className="line-item" key={k}><div className="row"><span>{product(i.product).name}</span><span className="amount">¥{C.money(i.cents)}</span></div><p className="quiet">数量：{i.quantity ?? 1} {product(i.product).unit}{product(i.product).spec ? ' · 规格型号：' + product(i.product).spec : ''}</p></div>)}</section>
      <section className="section"><h2>开票信息</h2><dl className="kv-wrap"><KV label="销方主体">{C.STORES[o.store].seller}</KV><KV label="销方税号">{C.STORES[o.store].sellerTaxNo}</KV>{o.application && <><KV label="购方抬头">{o.application.title}</KV>{o.application.type === 'company' && <KV label="购方税号">{o.application.taxId}</KV>}<KV label="接收邮箱">{o.deliveries?.length?o.deliveries[o.deliveries.length-1].email:o.application.email}</KV><KV label="申请时间">{fmtTime(o.application.submittedAt)}</KV></>}</dl>
        {o.invoice && <button className="order-action" onClick={() => go('/invoice/' + o.id)}><span>预览电子发票</span>{glyph('bi-b-arrow-right',16)}</button>}
        {o.refund?.status === 'success' && <button className="order-action" onClick={() => go('/invoice/' + o.id + '/red')}><span>预览红字发票</span>{glyph('bi-b-arrow-right',16)}</button>}
      </section>

    </main>
    {unissued&&<Footer><Button color="outline" onClick={() => go('/edit/' + o.id)}>修改</Button><Button onClick={() => go('/receipt/' + o.id)}>打印二维码</Button></Footer>}
    {processing&&<Footer><Button onClick={queryResult}>查询开票结果</Button></Footer>}
    {canResend&&<Footer><Button color="outline" onClick={revoke}>整单退票</Button><Button onClick={()=>go('/resend/'+o.id)}>重发邮件</Button></Footer>}
  </div>;
}
function ResendInvoice({o}) {
  const previous=o.deliveries?.length?o.deliveries[o.deliveries.length-1].email:o.application?.email||'';
  const [email,setEmail]=useState(previous),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=()=>{if(busy)return;setError('');setBusy(true);try{C.resend(o.id,email);go('/order/'+o.id);notify('已提交重发邮件');}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <div className="screen"><Nav title="重发邮件" back={()=>go('/order/'+o.id)}/><main className="content"><section className="section resend-form"><FieldItem title={<label htmlFor="resend-email">接收邮箱</label>}><Input id="resend-email" type="email" value={email} onChange={v=>{setEmail(v);setError('');}} placeholder="请输入接收邮箱"/></FieldItem>{error&&<div className="inline-error" role="alert">{error}</div>}</section></main><Footer><Button onClick={submit} disabled={busy}>确认发送</Button></Footer></div>;
}
function invoicePdf(o, red) {
  const {jsPDF} = window.jspdf;
  const pdf = new jsPDF({orientation:'landscape',unit:'mm',format:'a5'});
  pdf.addFileToVFS('invoice.ttf',window.INVOICE_FONT);pdf.addFont('invoice.ttf','InvoiceCJK','normal');pdf.setFont('InvoiceCJK');
  const ink='#C92A2A',sign=red?'-':'';
  const tax=o.items.reduce((s,i)=>s+Math.round(i.cents-i.cents/(1+product(i.product).rate)),0);
  const pageCount=Math.ceil(o.items.length/5);
  for(let pageIndex=0;pageIndex<pageCount;pageIndex++){
    if(pageIndex)pdf.addPage();
    pdf.setTextColor(ink);pdf.setDrawColor(ink);pdf.setFontSize(18);pdf.text('电子发票（普通发票）',105,18,{align:'center'});
    pdf.setFontSize(8);pdf.text('演示票样',190,10,{align:'right'});pdf.text('发票号码：'+(red?'H':'')+o.invoice.number,12,30);pdf.text('开票日期：'+C.date(new Date(red?o.refund.completedAt:o.invoice.issuedAt)),132,30);
    pdf.rect(10,35,190,30);pdf.setFontSize(9);pdf.text('购买方：'+o.application.title,14,44);pdf.text('销售方：'+C.STORES[o.store].seller,108,44);
    pdf.setFontSize(7);pdf.text('纳税人识别号：'+(o.application.taxId||'—'),14,55);pdf.text('订单编号：'+(o.number||o.id),108,55);
    pdf.rect(10,65,190,48);pdf.setFontSize(9);pdf.text('项目名称',14,73);pdf.text('规格型号',75,73);pdf.text('单位',98,73);pdf.text('数量',115,73);pdf.text('金额',145,73);pdf.text('税额',180,73);pdf.line(10,77,200,77);
    o.items.slice(pageIndex*5,pageIndex*5+5).forEach((i,k)=>{const p=product(i.product),vat=Math.round(i.cents-i.cents/(1+p.rate));pdf.text(p.name,14,84+k*6);pdf.text(p.spec||'—',75,84+k*6);pdf.text(p.unit,98,84+k*6);pdf.text(sign+String(i.quantity??1),115,84+k*6);pdf.text(sign+C.money(i.cents-vat),156,84+k*6,{align:'right'});pdf.text(sign+C.money(vat),192,84+k*6,{align:'right'});});
    pdf.setFontSize(10);pdf.text('价税合计：'+sign+'¥'+C.money(C.total(o)),14,125);pdf.setFontSize(7);pdf.text('仅供功能演示，非真实发票。',14,136);pdf.text('第 '+(pageIndex+1)+' / '+pageCount+' 页',190,136,{align:'right'});
    if(red){pdf.setTextColor(ink);pdf.setFontSize(26);pdf.text('红字发票',104,108,{align:'center'});}
  }
  return pdf;
}
function InvoicePreview({ o, red }) {
  const [blob,setBlob] = useState('');
  useEffect(() => { const pdf=invoicePdf(o,red),url=URL.createObjectURL(pdf.output('blob'));setBlob(url);return()=>URL.revokeObjectURL(url); },[o.id,red]);
  const tax=o.items.reduce((s,i)=>s+Math.round(i.cents-i.cents/(1+product(i.product).rate)),0),sign=red?'-':'';
  return <div className="screen"><Nav title={red?'红字发票':'电子发票'} back={() => go('/order/'+o.id)}/><main className="content"><div className="invoice-sheet"><div className="row info"><span>电子发票</span><span>演示票样</span></div><h1>电子发票（普通发票）</h1><div className="info">发票号码：{red?'H':''}{o.invoice.number}<br/>开票日期：{C.date(new Date(red?o.refund.completedAt:o.invoice.issuedAt))}<br/>购买方：{o.application.title}<br/>销售方：{C.STORES[o.store].seller}</div><table><thead><tr><th>项目名称</th><th>规格型号</th><th>单位</th><th>数量</th><th>金额</th></tr></thead><tbody>{o.items.map((i,k)=><tr key={k}><td>{product(i.product).name}</td><td>{product(i.product).spec||'—'}</td><td>{product(i.product).unit}</td><td>{sign}{i.quantity ?? 1}</td><td>{sign}{C.money(i.cents-Math.round(i.cents-i.cents/(1+product(i.product).rate)))}</td></tr>)}</tbody></table>{red&&<div className="watermark">红字发票</div>}<div className="info">税额：{sign}¥{C.money(tax)}<br/>价税合计：{sign}¥{C.money(C.total(o))}</div></div></main><Footer><Button color="outline" onClick={()=>{if(blob)window.open(blob,'_blank');}}>打开 PDF</Button><Button onClick={()=>invoicePdf(o,red).save((red?'红字发票_':'电子发票_')+o.id+'.pdf')}>下载 PDF</Button></Footer></div>;
}
function App() {
  const db=useData(),[route,setRoute]=useState(location.hash.slice(1)||'/');
  useEffect(()=>{const onRoute=()=>{setRoute(location.hash.slice(1)||'/');window.scrollTo(0,0);};window.addEventListener('hashchange',onRoute);return()=>window.removeEventListener('hashchange',onRoute);},[]);
  const [,section,id,rev,role]=route.split('/'),o=db.orders.find(x=>x.id===id);
  useEffect(()=>{const review=document.referrer.includes('review.html');if(review&&['qr','order','refund-order'].includes(section)&&o)window.parent.postMessage({type:'invoice-active-order',id:o.id,rev:o.rev},location.origin==='null'?'*':location.origin);},[route,o?.rev]);
  if(section==='invoicing')return <InvoiceHome/>;
  if(section==='refund')return <RefundSearch db={db}/>;
  if(section==='orders')return <OrderList db={db}/>;
  if(section==='new')return <OrderForm key="new" itemIndex={id==='item'?Number(rev):null}/>;
  if(!section)return <Home/>;
  if(!o)return <div className="screen"><Nav title="电子发票" back={()=>go('/orders')}/><div className="not-found">未找到这笔订单</div></div>;
  if(section==='edit')return !o.cancelled&&!o.application?<OrderForm key={o.id} order={o} itemIndex={rev==='item'?Number(role):null}/>:<OrderDetail o={o}/>;
  if(section==='resend')return o.invoice&&!o.cancelled&&!o.refund?<ResendInvoice key={o.id} o={o}/>:<OrderDetail o={o}/>;
  if(section==='qr')return <OrderDetail o={o}/>;
  if(section==='refund-order')return <OrderDetail o={o} origin="refund"/>;
  if(section==='order')return <OrderDetail o={o}/>;
  if(section==='receipt')return !o.cancelled&&!o.application?<ReceiptPage o={o}/>:<OrderDetail o={o}/>;
  if(section==='invoice')return o.invoice&&(rev!=='red'||o.refund?.status==='success')?<InvoicePreview key={o.id+'/'+rev} o={o} red={rev==='red'}/>:<OrderDetail o={o}/>;
  return <Home/>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
