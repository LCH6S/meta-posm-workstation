// Shared local Demo configuration; production must query the invoice/POS services separately.
(function(root){
 const KEY='sqb-manual-invoice-config-v1',CONTEXT='sqb-manual-invoice-context-v1';
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{version:1,brands:{},posEntries:{}};}catch{return {version:1,brands:{},posEntries:{}};}};
 const context=()=>{try{return JSON.parse(localStorage.getItem(CONTEXT))||{brandId:'700001',storeCode:'sqb002',sample:true};}catch{return {brandId:'700001',storeCode:'sqb002',sample:true};}};
 function current(){const c=context(),db=read(),brand=db.brands?.[c.brandId],store=brand?.stores?.[c.storeCode];return {context:c,brand,store,sample:c.sample===true&&c.storeCode==='sqb002'};}
 const entryVisible=()=>read().posEntries?.[context().brandId]!==false;
 const available=()=>{const x=current();return x.sample?true:!!x.store?.invoiceAvailable&&!!x.store?.manualEnabled;};
 const projects=()=>{const x=current();return x.sample?root.DemoCore.PRODUCTS:(x.store?.items??x.brand?.items??[]);};
 const storeId=(brandId,s)=>'cfg:'+brandId+':'+s.code+':'+(s.invoiceCompanyId||'none');
 function hydrate(db){if(!root.DemoCore)return;const C=root.DemoCore;for(const [id,s] of Object.entries(db.storeCatalog||{}))C.STORES[id]=s;for(const [brandId,b] of Object.entries(read().brands||{}))for(const s of Object.values(b.stores||{})){C.STORES[storeId(brandId,s)]={id:storeId(brandId,s),name:s.name,code:s.code,device:'POS-'+s.id,seller:s.seller,sellerTaxNo:s.sellerTaxNo,brandId};}}
 function activeStore(){const x=current();if(x.sample)return {...root.DemoCore.STORES.sqb002,code:'sqb002',brandId:x.context.brandId};if(!x.store)return null;hydrate(root.DemoCore.read());return root.DemoCore.STORES[storeId(x.context.brandId,x.store)];}
 function findProject(id){const db=read();for(const b of Object.values(db.brands||{})){const p=(b.items||[]).find(p=>p.id===id);if(p)return p;for(const s of Object.values(b.stores||{})){const p=s.items?.find(p=>p.id===id);if(p)return p;}}return root.DemoCore.PRODUCTS.find(p=>p.id===id)||root.DemoCore.read().projectCatalog?.[id]||{id,name:'开票项目',unit:'件',spec:'',rate:0.13};}
 function select(brandId,storeCode,sample=false){localStorage.setItem(CONTEXT,JSON.stringify({brandId,storeCode,sample}));root.dispatchEvent(new Event('invoice-data'));}
 root.InvoiceConfig={KEY,CONTEXT,read,context,current,available,entryVisible,projects,activeStore,findProject,hydrate,select};
})(window);
