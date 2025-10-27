
import React, { useState, useMemo, useEffect } from 'react';
import type { Recipe, Ad, Settings, AdminCredentials } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, BookOpenIcon, PrintIcon } from './components/Icons';
import Modal from './components/Modal';

// --- TYPE DEFINITIONS ---
type View = 'home' | 'about' | 'manageAds' | 'settings';
type ModalState = 
  | { type: 'addRecipe'; initialData?: Partial<Recipe> }
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
    gistUrl: 'https://gist.githubusercontent.com/mohazard555/adc1a6133164a7c1318ee91a7ca6670a/raw/recipe-studio-data.json',
    githubPat: '', // New field for PAT
};

const initialAdminCredentials: AdminCredentials = {
    username: 'admin',
    password: 'password'
};


// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Only compress images
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            if (!event.target?.result) {
                return reject(new Error("FileReader did not return a result."));
            }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }
                ctx.drawImage(img, 0, 0, width, height);

                // Using JPEG for compression with 85% quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Could not load image from file."));
            img.src = event.target.result as string;
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

const compressBase64Image = (base64Str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str.startsWith('data:image')) {
            return resolve(base64Str);
        }

        // Heuristic: if the base64 string represents an image smaller than ~225KB, don't re-compress.
        if (base64Str.length < 300 * 1024) {
            resolve(base64Str);
            return;
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 600;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("Could not load image from base64 string."));
        img.src = base64Str;
    });
};

const getGistIdFromUrl = (url: string): string | null => {
    if (!url) return null;
    try {
        const urlObject = new URL(url);
        // pathname for https://gist.githubusercontent.com/user/gistid/raw/... is /user/gistid/raw/...
        // pathname for https://gist.github.com/user/gistid is /user/gistid
        const pathParts = urlObject.pathname.split('/').filter(p => p);
        if (pathParts.length >= 2) {
            // Gist ID is usually the second part of the path, after the username
            const potentialId = pathParts[1];
            // Basic validation for a Gist ID (hex string, at least 20 chars long)
            if (/^[a-f0-9]{20,}/.test(potentialId)) {
                return potentialId;
            }
        }
        return null;
    } catch (e) {
        console.error("Invalid URL for Gist ID extraction", e);
        return null;
    }
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
        <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-56 object-cover"/>
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

const RecipeForm: React.FC<{ initialRecipe?: Partial<Recipe> | null; onSave: (recipe: Omit<Recipe, 'id'>, id?: string) => void; onCancel: () => void; }> = ({ initialRecipe, onSave, onCancel }) => {
    const [name, setName] = useState(initialRecipe?.name || '');
    const [category, setCategory] = useState(initialRecipe?.category || '');
    const [imageUrl, setImageUrl] = useState(initialRecipe?.imageUrl || '');
    const [imagePreview, setImagePreview] = useState(initialRecipe?.imageUrl || '');
    const [ingredients, setIngredients] = useState(initialRecipe?.ingredients?.join('\n') || '');
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
    onProceed: () => void;
    onCancel: () => void;
}> = ({ subscribeUrl, onProceed, onCancel }) => {
    
    const handleProceed = () => {
        window.open(subscribeUrl, '_blank', 'noopener,noreferrer');
        onProceed();
    };

    return (
        <div className="text-center p-4">
            <h3 className="text-xl font-bold text-gray-800 mb-2">للمتابعة، يرجى الاشتراك!</h3>
            <p className="text-gray-600 mb-6">
                عرض تفاصيل هذه الوصفة يتطلب الاشتراك في قناتنا على يوتيوب لدعمنا. اضغط على الزر أدناه لزيارة القناة وسيتم عرض الوصفة لك تلقائياً.
            </p>
            <button
                onClick={handleProceed}
                className="inline-flex items-center justify-center w-full mb-3 px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-red-600 hover:bg-red-700"
            >
                الانتقال للقناة وعرض الوصفة
            </button>
             <button
                onClick={onCancel}
                className="w-full px-4 py-2 border border-transparent rounded-md text-sm font-medium text-gray-500 hover:text-gray-700"
            >
                إلغاء
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
    recipes: Recipe[];
    ads: Ad[];
    onSettingsSave: (newSettings: Settings) => Promise<void>;
    onCredentialsSave: (newCreds: AdminCredentials) => void;
    onExport: () => void;
    onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onImagesOptimized: (newRecipes: Recipe[], newAds: Ad[]) => Promise<void>;
}> = ({ settings, credentials, recipes, ads, onSettingsSave, onCredentialsSave, onExport, onImport, onImagesOptimized }) => {

    const [localSettings, setLocalSettings] = useState(settings);
    const [localCreds, setLocalCreds] = useState(credentials);
    const [logoPreview, setLogoPreview] = useState(settings.siteLogo);
    const [isOptimizing, setIsOptimizing] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
        setLogoPreview(settings.siteLogo);
    }, [settings]);

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setLogoPreview(base64);
            setLocalSettings(s => ({ ...s, siteLogo: base64 }));
        }
    };

    const handleSettingsSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSettingsSave(localSettings);
        alert('تم حفظ إعدادات الموقع ومزامنتها!');
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

    const handleOptimizeImages = async () => {
        if (!window.confirm("سيقوم هذا الإجراء بتحسين جميع صور الوصفات والإعلانات لتقليل حجمها، مما يساعد على حل مشاكل المزامنة. قد يستغرق هذا بعض الوقت. هل تريد المتابعة؟")) {
            return;
        }
        setIsOptimizing(true);
        
        try {
            const newRecipes = await Promise.all(recipes.map(async (recipe) => {
                try {
                    const compressedUrl = await compressBase64Image(recipe.imageUrl);
                    return { ...recipe, imageUrl: compressedUrl };
                } catch (e) {
                    console.error(`Failed to compress image for recipe ${recipe.name}`, e);
                    return recipe;
                }
            }));

            const newAds = await Promise.all(ads.map(async (ad) => {
                try {
                    const compressedUrl = await compressBase64Image(ad.imageUrl);
                    return { ...ad, imageUrl: compressedUrl };
                } catch (e) {
                    console.error(`Failed to compress image for ad ${ad.title}`, e);
                    return ad;
                }
            }));

            await onImagesOptimized(newRecipes, newAds);
            alert('تم تحسين الصور ومزامنة البيانات بنجاح!');

        } catch (error) {
            alert('حدث خطأ أثناء تحسين الصور.');
            console.error(error);
        } finally {
            setIsOptimizing(false);
        }
    };


    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">الإعدادات</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Site Settings */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">إعدادات الموقع والمزامنة</h3>
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
                         <div className="border-t pt-4 space-y-4">
                             <p className="text-sm text-gray-600">
                                <b>لتمكين المزامنة عبر الإنترنت:</b><br/>
                                1. الصق <b>Gist Raw URL</b> في الحقل أدناه ليكون مصدر بيانات الموقع.<br/>
                                2. أنشئ <b>Personal Access Token (Classic)</b> من إعدادات GitHub مع صلاحية <b>`gist`</b> فقط.<br/>
                                3. الصق الـ Token في الحقل الثاني لتمكين الحفظ والمزامنة.
                             </p>
                            <label htmlFor="gistUrl" className="block text-sm font-medium text-gray-700">رابط Gist Raw للمزامنة</label>
                            <input 
                                type="url" 
                                id="gistUrl" 
                                value={localSettings.gistUrl} 
                                onChange={e => setLocalSettings({...localSettings, gistUrl: e.target.value})} 
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                                placeholder="https://gist.githubusercontent.com/user/id/raw/..."/>
                            
                            <label htmlFor="githubPat" className="block text-sm font-medium text-gray-700">GitHub Personal Access Token</label>
                            <input type="password" id="githubPat" value={localSettings.githubPat} onChange={e => setLocalSettings({...localSettings, githubPat: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500" placeholder="ghp_..."/>
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

                     <div className="bg-white p-6 rounded-lg shadow">
                         <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">صيانة البيانات</h3>
                         <p className="text-sm text-gray-600 mb-4">
                            إذا كنت تواجه أخطاء في المزامنة مثل "Validation Failed"، فقد يكون ذلك بسبب حجم الصور الكبير. استخدم هذا الخيار لضغط جميع الصور الحالية وحل المشكلة.
                         </p>
                         <button 
                            onClick={handleOptimizeImages}
                            disabled={isOptimizing}
                            className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400"
                        >
                            {isOptimizing ? 'جاري التحسين...' : 'تحسين حجم الصور ومزامنة'}
                        </button>
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
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [ads, setAds] = useState<Ad[]>([]);
    const [settings, setSettings] = useState<Settings>(initialSettings);
    const [adminCredentials, setAdminCredentials] = useLocalStorage<AdminCredentials>('adminCredentials', initialAdminCredentials);
    
    const [view, setView] = useState<View>('home');
    const [modalState, setModalState] = useState<ModalState>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
    const [isSubscribed, setIsSubscribed] = useLocalStorage<boolean>('ytSubscribed', false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // --- DATA LOADING & SAVING ---
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setFetchError(null);
            
            let localSettings: Settings | null = null;
            try {
                const localSettingsRaw = localStorage.getItem('settings');
                localSettings = localSettingsRaw ? JSON.parse(localSettingsRaw) : null;
            } catch (e) {
                console.warn("Could not access local storage for settings.", e);
            }
            
            const GIST_OLD_FILENAME = 'recipe-studio-data.json';
            const GIST_SETTINGS_FILENAME = 'settings.json';
            const GIST_RECIPES_FILENAME = 'recipes.json';
            const GIST_ADS_FILENAME = 'ads.json';

            const gistUrl = localSettings?.gistUrl || initialSettings.gistUrl;
            const gistId = getGistIdFromUrl(gistUrl);
            let wasFetchingOldFile = false;

            if (gistId) {
                console.log(`Attempting to fetch latest data from Gist API for ID: ${gistId}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 45000); // 45-second timeout

                try {
                    const gistDetailsResponse = await fetch(`https://api.github.com/gists/${gistId}?_=${new Date().getTime()}`, {
                        signal: controller.signal,
                        cache: 'reload',
                        headers: { 'Accept': 'application/vnd.github.v3+json' }
                    });

                    if (!gistDetailsResponse.ok) {
                        throw new Error(`فشل في جلب تفاصيل Gist: ${gistDetailsResponse.status} ${gistDetailsResponse.statusText}`);
                    }
                    const gistData = await gistDetailsResponse.json();
                    const files = gistData?.files;

                    let recipesFromGist, adsFromGist, settingsFromGist;

                    const newSettingsFile = files?.[GIST_SETTINGS_FILENAME];
                    const newRecipesFile = files?.[GIST_RECIPES_FILENAME];
                    const newAdsFile = files?.[GIST_ADS_FILENAME];
                    const oldDataFile = files?.[GIST_OLD_FILENAME];
                    
                    if (newSettingsFile && newRecipesFile && newAdsFile) {
                        console.log("Loading data from new multi-file format.");
                        const partialFetchErrors: string[] = [];
                        const fetchOrNull = (file: any, fileName: string): Promise<string | null> => 
                            fetch(`${file.raw_url}?_=${new Date().getTime()}`, { signal: controller.signal, cache: 'reload' })
                            .then(res => {
                                if (!res.ok) throw new Error(`فشل جلب ${fileName}: ${res.statusText}`);
                                return res.text();
                            })
                            .catch(err => {
                                console.warn(err);
                                partialFetchErrors.push(fileName.replace('.json', ''));
                                return null;
                            });
                        
                        const [settingsContent, recipesContent, adsContent] = await Promise.all([
                            fetchOrNull(newSettingsFile, GIST_SETTINGS_FILENAME),
                            fetchOrNull(newRecipesFile, GIST_RECIPES_FILENAME),
                            fetchOrNull(newAdsFile, GIST_ADS_FILENAME),
                        ]);
                        
                        const cachedSettings = JSON.parse(localStorage.getItem('settings') || 'null');
                        const cachedRecipes = JSON.parse(localStorage.getItem('recipes') || 'null');
                        const cachedAds = JSON.parse(localStorage.getItem('ads') || 'null');

                        settingsFromGist = settingsContent ? JSON.parse(settingsContent) : cachedSettings;
                        recipesFromGist = recipesContent ? JSON.parse(recipesContent) : cachedRecipes;
                        adsFromGist = adsContent ? JSON.parse(adsContent) : cachedAds;
                        
                        if (partialFetchErrors.length > 0) {
                            setFetchError(`فشل تحميل بعض البيانات (${partialFetchErrors.join(', ')}). قد تكون البيانات المعروضة غير محدّثة.`);
                        }

                    } else if (oldDataFile) {
                        console.log("Loading data from old single-file format.");
                        wasFetchingOldFile = true;
                        const rawUrl = oldDataFile.raw_url;
                        if (!rawUrl) throw new Error("Could not find raw_url for old data file.");

                        const rawContentResponse = await fetch(`${rawUrl}?_=${new Date().getTime()}`, { signal: controller.signal, cache: 'reload' });
                        if (!rawContentResponse.ok) throw new Error(`Failed to fetch content from ${rawUrl}`);
                        const fileContent = await rawContentResponse.text();
                        if (!fileContent.trim()) throw new Error("Old data file is empty.");

                        const data = JSON.parse(fileContent);
                        recipesFromGist = data.recipes || [];
                        adsFromGist = data.ads || [];
                        settingsFromGist = data.settings || {};
                    } else {
                        throw new Error(`No data files (${GIST_RECIPES_FILENAME}, ${GIST_ADS_FILENAME}, ${GIST_SETTINGS_FILENAME}, or ${GIST_OLD_FILENAME}) found in the Gist.`);
                    }
                    
                    clearTimeout(timeoutId);

                    const newSettings = {
                        ...initialSettings,
                        ...settingsFromGist,
                        gistUrl: gistUrl,
                        githubPat: localSettings?.githubPat || '',
                    };
                    
                    const finalRecipes = recipesFromGist ?? initialRecipes;
                    const finalAds = adsFromGist ?? initialAds;
                    
                    setRecipes(finalRecipes);
                    setAds(finalAds);
                    setSettings(newSettings);

                    try {
                        localStorage.setItem('recipes', JSON.stringify(finalRecipes));
                        localStorage.setItem('ads', JSON.stringify(finalAds));
                        localStorage.setItem('settings', JSON.stringify(newSettings));
                    } catch(e) {
                        console.warn("Could not save fetched data to local storage.", e);
                    }

                } catch (error) {
                    clearTimeout(timeoutId);
                    console.error("Fetch error:", error);
                    let errorMessage: string;
                    if (wasFetchingOldFile && error instanceof Error && error.name === 'AbortError') {
                        errorMessage = "فشل تحميل البيانات لأن الملف كبير جداً. إذا كنت مدير الموقع، قم بتسجيل الدخول ثم اذهب إلى الإعدادات واضغط 'حفظ الإعدادات' لترقية نظام المزامنة وحل المشكلة بشكل دائم.";
                    } else if (error instanceof Error && error.name === 'AbortError') {
                        errorMessage = "انتهت مهلة جلب البيانات. يتم عرض البيانات المحفوظة محلياً.";
                    } else if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                        errorMessage = "حدث خطأ في الشبكة. يرجى التحقق من اتصالك بالإنترنت. يتم عرض البيانات المحفوظة محلياً.";
                    } else if (error instanceof SyntaxError && error.message.includes('JSON.parse')) {
                        errorMessage = `خطأ في تحليل البيانات من الخادم: ${error.message}. يتم عرض البيانات المحفوظة محلياً.`;
                    } else if (error instanceof Error) {
                         errorMessage = `${error.message}. يتم عرض البيانات المحفوظة محلياً.`;
                    } else {
                        errorMessage = "فشل تحميل البيانات من الرابط. يتم عرض البيانات المحفوظة محلياً.";
                    }
                    setFetchError(errorMessage);
                    
                    // Fallback to local storage
                    try {
                        const cachedRecipes = JSON.parse(localStorage.getItem('recipes') || 'null');
                        const cachedAds = JSON.parse(localStorage.getItem('ads') || 'null');
                        
                        setRecipes(cachedRecipes || initialRecipes);
                        setAds(cachedAds || initialAds);
                        setSettings(localSettings || initialSettings);
                        console.log("Loaded data from cache due to fetch failure.");
                    } catch (e) {
                        console.warn("Could not read from cache, using initial data.", e);
                        setRecipes(initialRecipes);
                        setAds(initialAds);
                        setSettings(localSettings || initialSettings);
                    }
                }
            } else {
                // Offline context or no Gist ID found
                console.log("Could not extract Gist ID. Loading from local storage or initial data.");
                try {
                    const cachedRecipes = JSON.parse(localStorage.getItem('recipes') || 'null');
                    const cachedAds = JSON.parse(localStorage.getItem('ads') || 'null');
                    setRecipes(cachedRecipes || initialRecipes);
                    setAds(cachedAds || initialAds);
                    setSettings(localSettings || initialSettings);
                } catch(e) {
                    console.warn("Could not read from local storage, using initial data.", e);
                    setRecipes(initialRecipes);
                    setAds(initialAds);
                    setSettings(localSettings || initialSettings);
                }
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const saveAndSyncData = async (dataToSync: {
        recipes: Recipe[];
        ads: Ad[];
        settings: Settings;
    }) => {
        const { recipes, ads, settings } = dataToSync;

        try {
            localStorage.setItem('recipes', JSON.stringify(recipes));
            localStorage.setItem('ads', JSON.stringify(ads));
            localStorage.setItem('settings', JSON.stringify(settings));
        } catch (e) {
            console.error("Could not write to local storage.", e);
        }

        const GIST_OLD_FILENAME = 'recipe-studio-data.json';
        const GIST_SETTINGS_FILENAME = 'settings.json';
        const GIST_RECIPES_FILENAME = 'recipes.json';
        const GIST_ADS_FILENAME = 'ads.json';

        if (settings.gistUrl && settings.githubPat) {
            try {
                const gistId = getGistIdFromUrl(settings.gistUrl);

                if (!gistId) {
                    throw new Error("لم يتمكن من استخراج Gist ID صالح من الرابط. تأكد من أنك نسخت رابط Gist صحيح.");
                }

                const filesToSync = {
                    [GIST_SETTINGS_FILENAME]: {
                        content: JSON.stringify({ ...settings, githubPat: '' }, null, 2)
                    },
                    [GIST_RECIPES_FILENAME]: {
                        content: JSON.stringify(recipes, null, 2)
                    },
                    [GIST_ADS_FILENAME]: {
                        content: JSON.stringify(ads, null, 2)
                    },
                    // This will delete the old single file on the first sync after this update.
                    // If the file doesn't exist, GitHub's API ignores this.
                    [GIST_OLD_FILENAME]: null
                };

                const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${settings.githubPat}`,
                        'Accept': 'application/vnd.github.v3+json',
                    },
                    body: JSON.stringify({
                        description: `Recipe Studio Data - Last updated ${new Date().toISOString()}`,
                        files: filesToSync,
                    }),
                });

                if (!response.ok) {
                    let errorDetail = `Status: ${response.status} ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        errorDetail = errorData?.message || JSON.stringify(errorData);
                         if (response.status === 401) {
                            errorDetail = "رمز الوصول (PAT) غير صحيح أو منتهي الصلاحية.";
                        } else if (response.status === 404) {
                            errorDetail = "لم يتم العثور على Gist. تحقق من صحة الرابط.";
                        } else if (response.status === 422) {
                            errorDetail = "Validation Failed. قد يكون حجم أحد الملفات (مثل الإعلانات) كبيراً جداً. حاول تحسين حجم الصور من صفحة الإعدادات.";
                        }
                    } catch (e) {
                        console.warn("Could not parse Gist error response as JSON");
                    }
                    throw new Error(`فشل تحديث Gist: ${errorDetail}`);
                }
                console.log("Data synced to Gist successfully in multi-file format.");
            } catch (error) {
                console.error("Gist sync error:", error);
                let errorMessage: string;
                if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
                    errorMessage = "فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.";
                } else if (error instanceof Error) {
                    errorMessage = error.message;
                } else {
                    errorMessage = "حدث خطأ غير متوقع أثناء المزامنة.";
                }
                alert(`خطأ في المزامنة: ${errorMessage}. تم حفظ التغييرات محليًا.`);
            }
        }
    };


    // --- HANDLER FUNCTIONS ---
    // RECIPES
    const handleSaveRecipe = async (recipeData: Omit<Recipe, 'id'>, id?: string) => {
        const updatedRecipes = id
            ? recipes.map(r => (r.id === id ? { ...r, ...recipeData } : r))
            : [{ id: Date.now().toString(), ...recipeData }, ...recipes];

        setRecipes(updatedRecipes);
        await saveAndSyncData({ recipes: updatedRecipes, ads, settings });
        setModalState(null);
    };

    const handleDeleteRecipe = async (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الوصفة؟')) {
            const updatedRecipes = recipes.filter(r => r.id !== id);
            setRecipes(updatedRecipes);
            await saveAndSyncData({ recipes: updatedRecipes, ads, settings });
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
    const handleSaveAd = async (adData: Omit<Ad, 'id'>, id?: string) => {
        const updatedAds = id
            ? ads.map(a => (a.id === id ? { ...a, ...adData } : a))
            : [{ id: Date.now().toString(), ...adData }, ...ads];
        
        setAds(updatedAds);
        await saveAndSyncData({ recipes, ads: updatedAds, settings });
        setModalState(null);
    };

    const handleDeleteAd = async (id: string) => {
        const updatedAds = ads.filter(a => a.id !== id);
        setAds(updatedAds);
        await saveAndSyncData({ recipes, ads: updatedAds, settings });
    };

    // SETTINGS
    const handleSaveSettings = async (newSettings: Settings) => {
        setSettings(newSettings);
        await saveAndSyncData({ recipes, ads, settings: newSettings });
    };

    const handleImagesOptimized = async (newRecipes: Recipe[], newAds: Ad[]) => {
        setRecipes(newRecipes);
        setAds(newAds);
        await saveAndSyncData({ recipes: newRecipes, ads: newAds, settings });
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
            settings: { ...settings, githubPat: '' }, // Never export PAT
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
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                
                const recipesToImport = data.recipes || recipes;
                const adsToImport = data.ads || ads;
                const settingsToImport = data.settings ? { ...settings, ...data.settings } : settings;

                if (data.adminCredentials) {
                    setAdminCredentials(data.adminCredentials);
                }
                
                setRecipes(recipesToImport);
                setAds(adsToImport);
                setSettings(settingsToImport);

                await saveAndSyncData({ 
                    recipes: recipesToImport, 
                    ads: adsToImport, 
                    settings: settingsToImport 
                });

                alert("تم استيراد البيانات ومزامنتها بنجاح!");
            } catch (error) {
                alert("حدث خطأ أثناء قراءة الملف. تأكد من أنه ملف تصدير صحيح.");
            } finally {
                 e.target.value = ''; // Reset file input
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
                return <RecipeForm initialRecipe={modalState.initialData} onSave={handleSaveRecipe} onCancel={() => setModalState(null)} />;
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
                            onProceed={() => {
                                setIsSubscribed(true);
                                setModalState({ type: 'viewRecipe', recipe: modalState.recipe });
                            }} 
                            onCancel={() => setModalState(null)}
                        />;
            default:
                return null;
        }
    }, [modalState, settings.youtubeSubscribeLink, isSubscribed, recipes, ads, settings, adminCredentials]);
    
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
                {isLoading ? (
                    <div className="text-center py-20">
                         <p className="text-gray-600">جاري تحميل البيانات...</p>
                    </div>
                ) : (
                    <>
                        {fetchError && (
                            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                                <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded-md text-center">
                                    <strong className="font-bold">ملاحظة: </strong>
                                    <span>{fetchError}</span>
                                </div>
                            </div>
                        )}
                        
                        {view === 'home' && (
                            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                                    <h2 className="text-3xl font-bold text-gray-800">أحدث الوصفات</h2>
                                    {isLoggedIn && (
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setModalState({ type: 'addRecipe' })} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">
                                                <PlusIcon className="w-5 h-5 me-2"/>
                                                إضافة وصفة
                                            </button>
                                        </div>
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
                                        <p className="text-gray-500">لا توجد وصفات في هذا القسم.</p>
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
                        {view === 'settings' && isLoggedIn && <SettingsView 
                            settings={settings} 
                            credentials={adminCredentials} 
                            recipes={recipes}
                            ads={ads}
                            onSettingsSave={handleSaveSettings} 
                            onCredentialsSave={setAdminCredentials} 
                            onExport={handleExportData} 
                            onImport={handleImportData}
                            onImagesOptimized={handleImagesOptimized}
                            />}
                        {view === 'about' && <AboutView description={settings.siteDescription}/>}
                    </>
                )}
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
