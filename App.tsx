
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Recipe, Ad, Settings, AdminCredentials } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, BookOpenIcon, PrintIcon } from './components/Icons';
import Modal from './components/Modal';

// --- TYPE DEFINITIONS ---
type View = 'home' | 'about' | 'manageAds' | 'settings';
type ModalState = 
  | { type: 'addRecipe' }
  | { type: 'editRecipe'; recipe: Recipe }
  | { type: 'viewRecipe'; recipe: Recipe }
  | { type: 'addAd' }
  | { type: 'editAd'; ad: Ad }
  | { type: 'login' }
  | { type: 'subscribeToView'; recipe: Recipe }
  | null;

// --- INITIAL DATA ---
const initialRecipes: Recipe[] = [
    {
      id: '1',
      name: 'كيكة الشوكولاتة الغنية',
      category: 'حلويات',
      imageUrl: 'https://picsum.photos/seed/choco-cake/400/300',
      ingredients: ['2 كوب دقيق', '1 كوب سكر', '3/4 كوب كاكاو بودرة', '2 بيضة', '1 كوب حليب', '1/2 كوب زيت نباتي', '1 ملعقة صغيرة فانيليا'],
      steps: '1. سخن الفرن على 180 درجة مئوية. \n2. في وعاء كبير، اخلط المكونات الجافة. \n3. أضف البيض، الحليب، الزيت، والفانيليا واخفق جيدًا. \n4. صب الخليط في قالب مدهون واخبزه لمدة 30-35 دقيقة.'
    },
    {
        id: '2',
        name: 'دجاج مشوي بالليمون والأعشاب',
        category: 'أطباق رئيسية',
        imageUrl: 'https://picsum.photos/seed/grilled-chicken/400/300',
        ingredients: ['1 دجاجة كاملة', '1 ليمونة', '4 فصوص ثوم', 'ملح وفلفل', 'روزماري وزعتر طازج'],
        steps: '1. تبّل الدجاج بالملح والفلفل والثوم المهروس. \n2. ضع شرائح الليمون والأعشاب داخل الدجاجة. \n3. اشويها في الفرن على 200 درجة مئوية لمدة ساعة وربع أو حتى تنضج.'
    }
];

const initialAds: Ad[] = [
    {
        id: 'ad1',
        title: 'قناتنا على يوتيوب',
        description: 'شاهدوا أحدث وصفات الفيديو وتعلموا الطبخ خطوة بخطوة!',
        imageUrl: 'https://picsum.photos/seed/youtube-ad/400/300',
        link: 'https://www.youtube.com'
    }
];

const initialSettings: Settings = {
    siteName: 'استوديو الوصفات',
    siteDescription: 'مرحبًا بكم في استوديو الوصفات! هذه المنصة مصممة لتكون مساحتكم الخاصة لإدارة ومشاركة وصفات الطبخ بكل سهولة والمتعة. هدفنا هو توفير أداة بسيطة وفعالة تتيح لكم إضافة وصفاتكم المفضلة، تصفحها، وتعديلها في أي وقت، وكل ذلك يتم تخزينه بأمان على جهازكم الخاص دون الحاجة لاتصال بالإنترنت أو خوادم خارجية.',
    siteLogo: '', // Default empty, user can upload
    youtubeSubscribeLink: '',
};

const initialAdminCredentials: AdminCredentials = {
    username: 'admin',
    password: 'password'
};


// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// --- UI COMPONENTS ---
const Header: React.FC<{ 
    settings: Settings;
    setView: (view: View) => void; 
    currentView: View;
    isLoggedIn: boolean;
    onLoginClick: () => void;
    onLogoutClick: () => void;
}> = ({ settings, setView, currentView, isLoggedIn, onLoginClick, onLogoutClick }) => {
    
    const navLinkClasses = (view: View) => `px-4 py-2 rounded-md text-sm font-medium transition-colors ${currentView === view ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-orange-100 hover:text-orange-700'}`;

    return (
        <header className="bg-white shadow-md sticky top-0 z-40 no-print">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <button onClick={() => setView('home')} className="flex items-center gap-2">
                        {settings.siteLogo ? 
                            <img src={settings.siteLogo} alt="Site Logo" className="h-9 w-9 rounded-full object-cover"/> :
                            <BookOpenIcon className="h-8 w-8 text-orange-600" />
                        }
                        <h1 className="text-2xl font-bold text-gray-800">{settings.siteName}</h1>
                    </button>
                    <nav className="hidden md:flex items-center space-s-4">
                        <button onClick={() => setView('home')} className={navLinkClasses('home')}>الرئيسية</button>
                        {isLoggedIn && <button onClick={() => setView('manageAds')} className={navLinkClasses('manageAds')}>إدارة الإعلانات</button>}
                        {isLoggedIn && <button onClick={() => setView('settings')} className={navLinkClasses('settings')}>الإعدادات</button>}
                        <button onClick={() => setView('about')} className={navLinkClasses('about')}>عن الموقع</button>
                        {isLoggedIn ? (
                             <button onClick={onLogoutClick} className="px-4 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-100">تسجيل الخروج</button>
                        ) : (
                             <button onClick={onLoginClick} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">تسجيل الدخول</button>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
};

const RecipeCard: React.FC<{ recipe: Recipe; onView: () => void; onEdit: () => void; onDelete: () => void; isAdmin: boolean; }> = ({ recipe, onView, onEdit, onDelete, isAdmin }) => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
        <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-48 object-cover"/>
        <div className="p-4 flex flex-col flex-grow">
            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full self-start">{recipe.category}</span>
            <h3 className="text-lg font-bold mt-2 text-gray-800 flex-grow">{recipe.name}</h3>
            <div className="mt-4 flex justify-between items-center">
                <button onClick={onView} className="text-sm text-orange-600 hover:text-orange-800 font-semibold">عرض التفاصيل</button>
                {isAdmin && (
                    <div className="flex space-s-2">
                        <button onClick={onEdit} aria-label={`تعديل ${recipe.name}`} className="text-gray-400 hover:text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={onDelete} aria-label={`حذف ${recipe.name}`} className="text-gray-400 hover:text-red-600"><TrashIcon className="w-5 h-5"/></button>
                    </div>
                )}
            </div>
        </div>
    </div>
);

const AdCard: React.FC<{ ad: Ad }> = ({ ad }) => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <img src={ad.imageUrl} alt={ad.title} className="w-full h-40 object-cover"/>
        <div className="p-4">
            <h4 className="font-bold text-gray-800">{ad.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{ad.description}</p>
            <a href={ad.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block bg-amber-500 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-amber-600 transition-colors w-full text-center">
                زيارة الإعلان
            </a>
        </div>
    </div>
);

const RecipeForm: React.FC<{ initialRecipe?: Recipe | null; onSave: (recipe: Omit<Recipe, 'id'>, id?: string) => void; onCancel: () => void; }> = ({ initialRecipe, onSave, onCancel }) => {
    const [name, setName] = useState(initialRecipe?.name || '');
    const [category, setCategory] = useState(initialRecipe?.category || '');
    const [imageUrl, setImageUrl] = useState(initialRecipe?.imageUrl || '');
    const [imagePreview, setImagePreview] = useState(initialRecipe?.imageUrl || '');
    const [ingredients, setIngredients] = useState(initialRecipe?.ingredients.join('\n') || '');
    const [steps, setSteps] = useState(initialRecipe?.steps || '');

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImagePreview(URL.createObjectURL(file));
            const base64 = await fileToBase64(file);
            setImageUrl(base64);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const ingredientsArray = ingredients.split('\n').filter(line => line.trim() !== '');
        if (!name || !category || !imageUrl || ingredientsArray.length === 0 || !steps) {
            alert('يرجى ملء جميع الحقول.');
            return;
        }
        onSave({ name, category, imageUrl, ingredients: ingredientsArray, steps }, initialRecipe?.id);
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label htmlFor="recipeName" className="block text-sm font-medium text-gray-700">اسم الوصفة</label>
                <input type="text" id="recipeName" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required />
            </div>
             <div>
                <label htmlFor="recipeCategory" className="block text-sm font-medium text-gray-700">تصنيف الوصفة</label>
                <input type="text" id="recipeCategory" value={category} onChange={e => setCategory(e.target.value)} placeholder="مثال: حلويات، أطباق رئيسية..." className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required />
            </div>
            <div>
                 <label htmlFor="recipeImage" className="block text-sm font-medium text-gray-700">صورة الوصفة</label>
                 <input type="file" id="recipeImage" onChange={handleImageChange} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                 {imagePreview && <img src={imagePreview} alt="معاينة" className="mt-2 rounded-md w-40 h-40 object-cover"/>}
            </div>
             <div>
                <label htmlFor="recipeIngredients" className="block text-sm font-medium text-gray-700">المكونات (كل مكون في سطر)</label>
                <textarea id="recipeIngredients" value={ingredients} onChange={e => setIngredients(e.target.value)} rows={5} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required></textarea>
            </div>
            <div>
                <label htmlFor="recipeSteps" className="block text-sm font-medium text-gray-700">خطوات التحضير</label>
                <textarea id="recipeSteps" value={steps} onChange={e => setSteps(e.target.value)} rows={7} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required></textarea>
            </div>
            <div className="flex justify-end space-s-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">إلغاء</button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">حفظ الوصفة</button>
            </div>
        </form>
    );
};

const RecipeDetailView: React.FC<{ recipe: Recipe; onDownload: () => void; onPrint: () => void; }> = ({ recipe, onDownload, onPrint }) => {
    return (
        <div className="printable-area space-y-6">
            <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-64 object-cover rounded-lg"/>
            <div>
                <span className="text-sm bg-orange-100 text-orange-800 px-3 py-1 rounded-full">{recipe.category}</span>
            </div>
            <div>
                <h3 className="text-2xl font-bold text-gray-900">المكونات</h3>
                <ul className="mt-2 list-disc list-inside space-y-1 text-gray-700">
                    {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
            </div>
            <div>
                <h3 className="text-2xl font-bold text-gray-900">خطوات التحضير</h3>
                <p className="mt-2 whitespace-pre-wrap text-gray-700">{recipe.steps}</p>
            </div>
            <div className="text-center pt-4 no-print flex justify-center gap-4">
                 <button onClick={onDownload} className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-orange-600 hover:bg-orange-700">
                    <DownloadIcon className="w-5 h-5 me-2"/>
                    تحميل الوصفة
                </button>
                <button onClick={onPrint} className="inline-flex items-center px-6 py-2 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50">
                    <PrintIcon className="w-5 h-5 me-2"/>
                    طباعة الوصفة
                </button>
            </div>
        </div>
    );
};

const AdForm: React.FC<{ initialAd?: Ad | null; onSave: (ad: Omit<Ad, 'id'>, id?: string) => void; onCancel: () => void; }> = ({ initialAd, onSave, onCancel }) => {
    const [title, setTitle] = useState(initialAd?.title || '');
    const [description, setDescription] = useState(initialAd?.description || '');
    const [link, setLink] = useState(initialAd?.link || '');
    const [imageUrl, setImageUrl] = useState(initialAd?.imageUrl || '');
    const [imagePreview, setImagePreview] = useState(initialAd?.imageUrl || '');

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImagePreview(URL.createObjectURL(file));
            const base64 = await fileToBase64(file);
            setImageUrl(base64);
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !description || !link || !imageUrl) {
            alert('يرجى ملء جميع الحقول.');
            return;
        }
        onSave({ title, description, link, imageUrl }, initialAd?.id);
    };

    return (
         <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label htmlFor="adTitle" className="block text-sm font-medium text-gray-700">عنوان الإعلان</label>
                <input type="text" id="adTitle" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required />
            </div>
            <div>
                <label htmlFor="adDescription" className="block text-sm font-medium text-gray-700">وصف قصير</label>
                <textarea id="adDescription" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required></textarea>
            </div>
             <div>
                <label htmlFor="adLink" className="block text-sm font-medium text-gray-700">الرابط</label>
                <input type="url" id="adLink" value={link} onChange={e => setLink(e.target.value)} placeholder="https://example.com" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required />
            </div>
            <div>
                 <label htmlFor="adImage" className="block text-sm font-medium text-gray-700">صورة الإعلان</label>
                 <input type="file" id="adImage" onChange={handleImageChange} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                 {imagePreview && <img src={imagePreview} alt="معاينة" className="mt-2 rounded-md w-40 h-40 object-cover"/>}
            </div>
            <div className="flex justify-end space-s-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">إلغاء</button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">حفظ الإعلان</button>
            </div>
        </form>
    );
};

const LoginModalContent: React.FC<{ onLogin: (u: string, p: string) => void; onCancel: () => void; }> = ({ onLogin, onCancel }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
         <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">اسم المستخدم</label>
                <input type="text" id="username" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required />
            </div>
            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">كلمة المرور</label>
                <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" required />
            </div>
            <div className="flex justify-end space-s-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">إلغاء</button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">دخول</button>
            </div>
        </form>
    );
};

const SubscribeModalContent: React.FC<{
    subscribeUrl: string;
    onSubscribed: () => void;
}> = ({ subscribeUrl, onSubscribed }) => {
    return (
        <div className="text-center p-4">
            <h3 className="text-xl font-bold text-gray-800 mb-2">للمتابعة، يرجى الاشتراك!</h3>
            <p className="text-gray-600 mb-6">
                عرض تفاصيل هذه الوصفة يتطلب الاشتراك في قناتنا على يوتيوب لدعمنا وتقديم المزيد من المحتوى الرائع.
            </p>
            <a
                href={subscribeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full mb-3 px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-red-600 hover:bg-red-700"
            >
                الاشتراك في القناة
            </a>
            <button
                onClick={onSubscribed}
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
                لقد اشتركت، تابع إلى الوصفة
            </button>
        </div>
    );
};


const ManageAdsView: React.FC<{ ads: Ad[]; setModalState: (state: ModalState) => void; deleteAd: (id: string) => void }> = ({ ads, setModalState, deleteAd }) => {
    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">إدارة الإعلانات</h2>
                <button onClick={() => setModalState({ type: 'addAd' })} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">
                    <PlusIcon className="w-5 h-5 me-2"/>
                    إضافة إعلان جديد
                </button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {ads.length > 0 ? ads.map(ad => (
                         <li key={ad.id} className="p-4 flex items-center justify-between">
                             <div className="flex items-center">
                                 <img src={ad.imageUrl} alt={ad.title} className="w-16 h-16 object-cover rounded-md me-4"/>
                                 <div>
                                     <p className="font-semibold text-gray-800">{ad.title}</p>
                                     <a href={ad.link} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 hover:underline">{ad.link}</a>
                                 </div>
                             </div>
                             <div className="flex space-s-3">
                                <button onClick={() => setModalState({ type: 'editAd', ad })} className="text-gray-500 hover:text-blue-600 transition-colors"><PencilIcon className="w-5 h-5"/></button>
                                <button onClick={() => { if(window.confirm('هل أنت متأكد من حذف هذا الإعلان؟')) deleteAd(ad.id) }} className="text-gray-500 hover:text-red-600 transition-colors"><TrashIcon className="w-5 h-5"/></button>
                             </div>
                         </li>
                    )) : (
                        <li className="p-6 text-center text-gray-500">لا توجد إعلانات لعرضها.</li>
                    )}
                </ul>
            </div>
        </div>
    );
};

const AboutView: React.FC<{description: string}> = ({ description }) => (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">عن استوديو الوصفات</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{description}</p>
            <p className="text-gray-600 leading-relaxed mt-4">
                نأمل أن تستمتعوا باستخدام المنصة وتجدوها مفيدة في رحلتكم لإبداع أشهى الأطباق.
            </p>
        </div>
    </div>
);

const SettingsView: React.FC<{
    settings: Settings;
    credentials: AdminCredentials;
    onSettingsSave: (newSettings: Settings) => void;
    onCredentialsSave: (newCreds: AdminCredentials) => void;
    onExport: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ settings, credentials, onSettingsSave, onCredentialsSave, onExport, onImport }) => {

    const [localSettings, setLocalSettings] = useState(settings);
    const [localCreds, setLocalCreds] = useState(credentials);
    const [logoPreview, setLogoPreview] = useState(settings.siteLogo);

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setLogoPreview(base64);
            setLocalSettings(s => ({ ...s, siteLogo: base64 }));
        }
    };

    const handleSettingsSave = (e: React.FormEvent) => {
        e.preventDefault();
        onSettingsSave(localSettings);
        alert('تم حفظ إعدادات الموقع!');
    };

     const handleCredentialsSave = (e: React.FormEvent) => {
        e.preventDefault();
        if(!localCreds.username || !localCreds.password) {
            alert('اسم المستخدم وكلمة المرور لا يمكن أن تكون فارغة.');
            return;
        }
        onCredentialsSave(localCreds);
        alert('تم حفظ بيانات الدخول!');
    };


    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">الإعدادات</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Site Settings */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">إعدادات الموقع</h3>
                    <form onSubmit={handleSettingsSave} className="space-y-4">
                        <div>
                            <label htmlFor="siteName" className="block text-sm font-medium text-gray-700">اسم الموقع</label>
                            <input type="text" id="siteName" value={localSettings.siteName} onChange={e => setLocalSettings({...localSettings, siteName: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                        <div>
                            <label htmlFor="siteDescription" className="block text-sm font-medium text-gray-700">وصف الموقع</label>
                            <textarea id="siteDescription" value={localSettings.siteDescription} onChange={e => setLocalSettings({...localSettings, siteDescription: e.target.value})} rows={4} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" />
                        </div>
                        <div>
                            <label htmlFor="youtubeLink" className="block text-sm font-medium text-gray-700">رابط قناة يوتيوب للاشتراك</label>
                            <input type="url" id="youtubeLink" value={localSettings.youtubeSubscribeLink} onChange={e => setLocalSettings({...localSettings, youtubeSubscribeLink: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" placeholder="https://www.youtube.com/channel/..."/>
                        </div>
                        <div>
                            <label htmlFor="siteLogo" className="block text-sm font-medium text-gray-700">شعار الموقع</label>
                            <input type="file" id="siteLogo" onChange={handleLogoChange} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                            {logoPreview && <img src={logoPreview} alt="معاينة الشعار" className="mt-2 rounded-md w-24 h-24 object-cover"/>}
                        </div>
                        <div className="text-right">
                             <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">حفظ الإعدادات</button>
                        </div>
                    </form>
                </div>
                
                {/* Admin & Data Settings */}
                <div className="space-y-8">
                    <div className="bg-white p-6 rounded-lg shadow">
                         <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">بيانات الدخول</h3>
                         <form onSubmit={handleCredentialsSave} className="space-y-4">
                             <div>
                                <label htmlFor="adminUser" className="block text-sm font-medium text-gray-700">اسم المستخدم</label>
                                <input type="text" id="adminUser" value={localCreds.username} onChange={e => setLocalCreds({...localCreds, username: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" />
                            </div>
                            <div>
                                <label htmlFor="adminPass" className="block text-sm font-medium text-gray-700">كلمة المرور</label>
                                <input type="password" id="adminPass" value={localCreds.password} onChange={e => setLocalCreds({...localCreds, password: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" />
                            </div>
                            <div className="text-right">
                                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">حفظ البيانات</button>
                            </div>
                         </form>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow">
                         <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">إدارة البيانات</h3>
                         <div className="flex items-center justify-around">
                            <button onClick={onExport} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">تصدير البيانات</button>
                            <div>
                                <label htmlFor="import-file" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">استيراد البيانات</label>
                                <input id="import-file" type="file" onChange={onImport} className="hidden" accept=".json"/>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CategoryFilter: React.FC<{
    recipes: Recipe[];
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
}> = ({ recipes, selectedCategory, onSelectCategory }) => {
    const categories = useMemo(() => ['الكل', ...new Set(recipes.map(r => r.category))], [recipes]);

    return (
        <div className="mb-6 flex flex-wrap gap-2">
            {categories.map(category => {
                const isActive = category === selectedCategory;
                return (
                    <button
                        key={category}
                        onClick={() => onSelectCategory(category)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                            isActive 
                            ? 'bg-orange-600 text-white shadow' 
                            : 'bg-white text-gray-700 hover:bg-orange-100'
                        }`}
                    >
                        {category}
                    </button>
                );
            })}
        </div>
    );
};


// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [recipes, setRecipes] = useLocalStorage<Recipe[]>('recipes', initialRecipes);
    const [ads, setAds] = useLocalStorage<Ad[]>('ads', initialAds);
    const [settings, setSettings] = useLocalStorage<Settings>('settings', initialSettings);
    const [adminCredentials, setAdminCredentials] = useLocalStorage<AdminCredentials>('adminCredentials', initialAdminCredentials);
    
    const [view, setView] = useState<View>('home');
    const [modalState, setModalState] = useState<ModalState>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
    const [isSubscribed, setIsSubscribed] = useLocalStorage<boolean>('ytSubscribed', false);


    // --- HANDLER FUNCTIONS ---
    // RECIPES
    const handleSaveRecipe = (recipeData: Omit<Recipe, 'id'>, id?: string) => {
        if (id) {
            setRecipes(prev => prev.map(r => r.id === id ? { ...r, ...recipeData } : r));
        } else {
            const newRecipe: Recipe = { id: Date.now().toString(), ...recipeData };
            setRecipes(prev => [newRecipe, ...prev]);
        }
        setModalState(null);
    };

    const handleDeleteRecipe = (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الوصفة؟')) {
            setRecipes(prev => prev.filter(r => r.id !== id));
        }
    };
    
    const handleDownloadRecipe = (recipe: Recipe) => {
      let content = `اسم الوصفة: ${recipe.name}\n`;
      content += `التصنيف: ${recipe.category}\n\n`;
      content += `========================\n`;
      content += `المكونات:\n`;
      content += `========================\n`;
      recipe.ingredients.forEach(ing => {
        content += `- ${ing}\n`;
      });
      content += `\n========================\n`;
      content += `خطوات التحضير:\n`;
      content += `========================\n${recipe.steps}\n`;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recipe.name.replace(/\s/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
      window.print();
    };

    // ADS
    const handleSaveAd = (adData: Omit<Ad, 'id'>, id?: string) => {
        if (id) {
            setAds(prev => prev.map(a => a.id === id ? { ...a, ...adData } : a));
        } else {
            const newAd: Ad = { id: Date.now().toString(), ...adData };
            setAds(prev => [newAd, ...prev]);
        }
        setModalState(null);
    };

    const handleDeleteAd = (id: string) => {
        setAds(prev => prev.filter(a => a.id !== id));
    };

    // AUTHENTICATION
    const handleLogin = (username: string, password: string) => {
        if (username === adminCredentials.username && password === adminCredentials.password) {
            setIsLoggedIn(true);
            setModalState(null);
        } else {
            alert('بيانات الدخول غير صحيحة.');
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setView('home');
    };

    // DATA MANAGEMENT
    const handleExportData = () => {
        const data = {
            recipes,
            ads,
            settings,
            adminCredentials
        };
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recipe-studio-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm("هل أنت متأكد من استيراد البيانات؟ هذا سيقوم بالكتابة فوق جميع بياناتك الحالية.")) {
            e.target.value = ''; // Reset file input
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.recipes) setRecipes(data.recipes);
                if (data.ads) setAds(data.ads);
                if (data.settings) setSettings(data.settings);
                if (data.adminCredentials) setAdminCredentials(data.adminCredentials);
                alert("تم استيراد البيانات بنجاح! سيتم إعادة تحميل الصفحة.");
                window.location.reload();
            } catch (error) {
                alert("حدث خطأ أثناء قراءة الملف. تأكد من أنه ملف تصدير صحيح.");
            }
        };
        reader.readAsText(file);
    };


    // --- MEMOIZED VALUES ---
    const filteredRecipes = useMemo(() => {
        if (selectedCategory === 'الكل') return recipes;
        return recipes.filter(r => r.category === selectedCategory);
    }, [recipes, selectedCategory]);

    const modalContent = useMemo(() => {
        if (!modalState) return null;

        switch(modalState.type) {
            case 'addRecipe':
                return <RecipeForm onSave={handleSaveRecipe} onCancel={() => setModalState(null)} />;
            case 'editRecipe':
                return <RecipeForm initialRecipe={modalState.recipe} onSave={handleSaveRecipe} onCancel={() => setModalState(null)} />;
            case 'viewRecipe':
                return <RecipeDetailView recipe={modalState.recipe} onDownload={() => handleDownloadRecipe(modalState.recipe)} onPrint={handlePrint} />;
            case 'addAd':
                return <AdForm onSave={handleSaveAd} onCancel={() => setModalState(null)} />;
            case 'editAd':
                 return <AdForm initialAd={modalState.ad} onSave={handleSaveAd} onCancel={() => setModalState(null)} />;
            case 'login':
                return <LoginModalContent onLogin={handleLogin} onCancel={() => setModalState(null)} />;
            case 'subscribeToView':
                return <SubscribeModalContent 
                            subscribeUrl={settings.youtubeSubscribeLink} 
                            onSubscribed={() => {
                                setIsSubscribed(true);
                                setModalState({ type: 'viewRecipe', recipe: modalState.recipe });
                            }} 
                        />;
            default:
                return null;
        }
    }, [modalState, recipes, ads, settings.youtubeSubscribeLink, isSubscribed]);
    
    const modalTitle = useMemo(() => {
        if (!modalState) return '';
        switch(modalState.type) {
            case 'addRecipe': return 'إضافة وصفة جديدة';
            case 'editRecipe': return 'تعديل الوصفة';
            case 'viewRecipe': return modalState.recipe.name;
            case 'addAd': return 'إضافة إعلان جديد';
            case 'editAd': return 'تعديل الإعلان';
            case 'login': return 'تسجيل دخول المدير';
            case 'subscribeToView': return 'خطوة أخيرة لعرض الوصفة!';
            default: return '';
        }
    }, [modalState]);
    
    // --- RENDER ---
    return (
        <div className="bg-stone-50 min-h-screen">
            <Header 
                settings={settings}
                setView={setView} 
                currentView={view}
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setModalState({ type: 'login' })}
                onLogoutClick={handleLogout}
            />

            <main>
                {view === 'home' && (
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                            <h2 className="text-3xl font-bold text-gray-800">أحدث الوصفات</h2>
                            {isLoggedIn && (
                                <button onClick={() => setModalState({ type: 'addRecipe' })} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">
                                    <PlusIcon className="w-5 h-5 me-2"/>
                                    إضافة وصفة
                                </button>
                            )}
                        </div>
                        <CategoryFilter recipes={recipes} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
                        {filteredRecipes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredRecipes.map(recipe => (
                                    <RecipeCard 
                                        key={recipe.id} 
                                        recipe={recipe} 
                                        isAdmin={isLoggedIn}
                                        onView={() => {
                                            if (isLoggedIn || isSubscribed) {
                                                setModalState({ type: 'viewRecipe', recipe });
                                            } else if (settings.youtubeSubscribeLink) {
                                                setModalState({ type: 'subscribeToView', recipe });
                                            } else {
                                                setModalState({ type: 'viewRecipe', recipe });
                                            }
                                        }}
                                        onEdit={() => setModalState({ type: 'editRecipe', recipe })}
                                        onDelete={() => handleDeleteRecipe(recipe.id)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-white rounded-lg shadow">
                                <p className="text-gray-500">لا توجد وصفات في هذا القسم. لم لا تضيف واحدة؟</p>
                            </div>
                        )}
                        
                        <div className="mt-12">
                             <h2 className="text-3xl font-bold text-gray-800 mb-6">إعلانات ترويجية</h2>
                             {ads.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {ads.map(ad => <AdCard key={ad.id} ad={ad} />)}
                                </div>
                             ) : (
                                <div className="text-center py-10 bg-white rounded-lg shadow">
                                    {isLoggedIn ? <p className="text-gray-500">لا توجد إعلانات. يمكنك إضافة إعلان من صفحة إدارة الإعلانات.</p> : <p className="text-gray-500">لا توجد إعلانات لعرضها.</p>}
                                </div>
                             )}
                        </div>
                    </div>
                )}
                {view === 'manageAds' && isLoggedIn && <ManageAdsView ads={ads} setModalState={setModalState} deleteAd={handleDeleteAd} />}
                {view === 'settings' && isLoggedIn && <SettingsView settings={settings} credentials={adminCredentials} onSettingsSave={setSettings} onCredentialsSave={setAdminCredentials} onExport={handleExportData} onImport={handleImportData}/>}
                {view === 'about' && <AboutView description={settings.siteDescription}/>}
            </main>
            
            <Modal isOpen={!!modalState} onClose={() => setModalState(null)} title={modalTitle}>
                {modalContent}
            </Modal>
            
            <footer className="bg-white mt-12 py-6 border-t no-print">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
                    <p>&copy; {new Date().getFullYear()} {settings.siteName}. جميع الحقوق محفوظة.</p>
                    <p className="text-xs mt-2">// المطور mohannad ahmad لاعلاناتكم التواصل عبر الرقم +963998171954</p>
                </div>
            </footer>
        </div>
    );
};

export default App;