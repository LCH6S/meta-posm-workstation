// Meta POS components. Visual source: Meta-Pos-App / 相关规范 and refund/search/detail screens.
(() => {
  const {useEffect,useState,useRef}=React;
  const assets='assets/meta-pos/';
  const iconFiles={'bi-b-arrow-left':'back.svg','bi-b-scan':'scan.svg','bi-b-search':'search.svg','bi-b-success':'success.svg'};
  const actionNames={'bi-b-close':'关闭','bi-b-delete':'移除','bi-b-select-down':'选择','bi-b-arrow-right':'查看','bi-b-arrow-down':'展开','bi-b-arrow-up':'收起'};
  function Icon({name,fontSize=20}){
    if(iconFiles[name])return <span className={'meta-icon icon-'+name} aria-hidden="true"><img src={assets+iconFiles[name]} alt=""/></span>;
    return actionNames[name]?<span className="icon-word" aria-hidden="true">{actionNames[name]}</span>:null;
  }
  function Button({children,color='primary',className='',full=true,size='large',...props}){return <button {...props} className={'meta-button '+color+' '+size+' '+(full?'full ':'')+className}>{children}</button>;}
  function NavBar({children,onBack,right}){return <div className="meta-navbar"><button className="meta-back" aria-label="返回" onClick={onBack}><Icon name="bi-b-arrow-left"/></button><div className="meta-title">{children}</div><div className="meta-nav-right">{right}</div></div>;}
  function FieldItem({title,children}){return <div className="meta-field"><div className="meta-field-label">{title}</div><div className="meta-field-control">{children}</div></div>;}
  function Input({onChange,value,...props}){return <input {...props} className="meta-input" value={value} onChange={e=>onChange?.(e.target.value)}/>;}
  function Search({value,onChange,onSearch,placeholder}){return <form className="meta-search" onSubmit={e=>{e.preventDefault();onSearch(value);}}><div className="meta-search-box"><Icon name="bi-b-search"/><input aria-label="查询订单号" type="search" value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></div><button type="submit">查询</button></form>;}
  function HotPopup({visible,children,onClose}){
    const ref=useRef(null);
    useEffect(()=>{if(visible)ref.current?.showModal();else ref.current?.close();},[visible]);
    return <dialog className="meta-sheet" ref={ref} onCancel={e=>{e.preventDefault();onClose?.();}} onClick={e=>{if(e.target===ref.current)onClose?.();}}>{visible&&children}</dialog>;
  }
  function HotDatePicker({visible,value,max,onClose,onConfirm,title}){
    const [v,setV]=useState('');useEffect(()=>{if(visible)setV(DemoCore.date(value||new Date()));},[visible]);
    return <HotPopup visible={visible} onClose={onClose}><div className="popup-title">{title}</div><div className="date-picker-body"><label htmlFor="sale-date-picker">实际销售完成日期</label><input id="sale-date-picker" type="date" value={v} max={DemoCore.date(max||new Date())} onChange={e=>setV(e.target.value)}/><Button onClick={()=>{if(v)onConfirm(new Date(v+'T12:00:00'));}}>确定</Button><Button color="normal" onClick={onClose}>取消</Button></div></HotPopup>;
  }
  const toast={show({message}){const n=document.createElement('div');n.className='meta-toast';n.setAttribute('role','status');n.textContent=message;document.body.append(n);setTimeout(()=>n.remove(),1800);}};
  const dialog={confirm({title,content,okText='确认',cancelText='取消'}){return new Promise(resolve=>{const el=document.createElement('dialog');el.className='meta-confirm';const heading=document.createElement('h2'),body=document.createElement('p'),actions=document.createElement('div'),no=document.createElement('button'),yes=document.createElement('button');heading.textContent=title;body.textContent=content;no.textContent=cancelText;yes.textContent=okText;no.className='meta-button outline';yes.className='meta-button primary';actions.className='confirm-actions';actions.append(no,yes);el.append(heading,body,actions);document.body.append(el);let settled=false;const finish=v=>{if(settled)return;settled=true;el.close();el.remove();resolve(v);};no.onclick=()=>finish(false);yes.onclick=()=>finish(true);el.oncancel=e=>{e.preventDefault();finish(false);};el.showModal();no.focus();});}};
  window.MetaPOS={Button,NavBar,FieldItem,Input,Search,HotPopup,HotDatePicker,Icon,dialog,toast};
})();
