import {useEffect,useState} from 'react';
import {Heart} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {useLanguage} from '../context/LanguageContext';
import {AuthModal} from './AuthModal';
import {getSavedItems,setSavedItem,type SavedItemType} from '../lib/accountFavoritesService';
export function AccountFavoriteHeart({type,id,compact=false}:{type:SavedItemType;id:string;compact?:boolean}) {
 const {user,loading}=useAuth();const {language}=useLanguage();const [saved,setSaved]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');const [authOpen,setAuthOpen]=useState(false);
 useEffect(()=>{let active=true;setSaved(false);if(user)getSavedItems(user.id).then(items=>{if(active)setSaved(items.some(item=>item.item_type===type&&item.item_id===id));}).catch(()=>{if(active)setError('Favorites unavailable');});return()=>{active=false};},[user?.id,type,id]);
 const labels={en:['Save to My Favorites','Remove from My Favorites'],th:['บันทึกในรายการโปรด','นำออกจากรายการโปรด'],zh:['加入我的收藏','取消收藏']}[language];
 async function toggle(){if(!user){setAuthOpen(true);return;}if(pending)return;setPending(true);setError('');try{await setSavedItem(user.id,type,id,!saved);setSaved(!saved);}catch{setError(language==='th'?'บันทึกไม่สำเร็จ':language==='zh'?'保存失败':'Could not save favorite');}finally{setPending(false);}}
 return <span className="inline-flex flex-col items-start gap-1"><button type="button" disabled={pending||loading} aria-pressed={saved} aria-label={labels[saved?1:0]} title={labels[saved?1:0]} onClick={()=>void toggle()} className="inline-flex items-center gap-2 rounded-full border border-[#C76624]/35 bg-[#FFF9EE] px-3 py-2 text-sm font-medium text-[#A44F1D] hover:bg-[#FFF1E5] disabled:opacity-50"><Heart size={18} fill={saved?'currentColor':'none'}/>{!compact&&labels[saved?1:0]}</button>{error&&<span role="alert" className="text-xs text-red-700">{error}</span>}<AuthModal isOpen={authOpen} onClose={()=>setAuthOpen(false)}/></span>;
}
