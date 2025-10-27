
import React, { useState, useMemo, useEffect } from 'react';
import type { Recipe, Ad, Settings, AdminCredentials } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSessionStorage } from './hooks/useSessionStorage';
import { PlusIcon, TrashIcon, PencilIcon, DownloadIcon, BookOpenIcon, PrintIcon, CloseIcon } from './components/Icons';
import Modal from './components/Modal';
import { ToastContainer, ToastProps } from './components/Toast';


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
type ToastMessage = Omit<ToastProps, 'onClose' | 'id'>;

// --- INITIAL DATA ---
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

const fetchJsonWithCacheBust = async (url: string, token?: string) => {
    const fetchOptions: RequestInit = { cache: 'reload' };
    if (token) {
        fetchOptions.headers = { 'Authorization': `token ${token}` };
    }
    const res = await fetch(`${url}?_=${new Date().getTime()}`, fetchOptions);
    if (!res.ok) throw new Error(`فشل في جلب ${url}`);

    const contentLength = res.headers.get('Content-Length');
    // Set a 25MB limit to prevent browser crashes on large JSON parsing.
    const MAX_SIZE_BYTES = 25 * 1024 * 1024;
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE_BYTES) {
        throw new Error(`حجم ملف البيانات (${(parseInt(contentLength, 10) / 1024 / 1024).toFixed(1)}MB) كبير جدًا ولا يمكن معالجته.`);
    }

    return res.json();
};

const downloadRecipeAsText = (recipe: Recipe) => {
    const content = `
# ${recipe.name}

**التصنيف:** ${recipe.category}

## المكونات
${recipe.ingredients.map(ing => `- ${ing}`).join('\n')}

## خطوات التحضير
${recipe.steps}
    `;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${recipe.name}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    const draftKey = `recipe-form-draft-${initialRecipe?.id || 'new'}`;
    const [name, setName] = useSessionStorage(draftKey + '-name', initialRecipe?.name || '');
    const [category, setCategory] = useSessionStorage(draftKey + '-category', initialRecipe?.category || '');
    const [imageUrl, setImageUrl] = useSessionStorage(draftKey + '-imageUrl', initialRecipe?.imageUrl || '');
    const [imagePreview, setImagePreview] = useState(initialRecipe?.imageUrl || '');
    const [ingredients, setIngredients] = useSessionStorage(draftKey + '-ingredients', initialRecipe?.ingredients?.join('\n') || '');
    const [steps, setSteps] = useSessionStorage(draftKey + '-steps', initialRecipe?.steps || '');

    useEffect(() => {
        if(initialRecipe?.imageUrl) setImagePreview(initialRecipe.imageUrl);
    }, [initialRecipe]);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl); 
            const base64 = await fileToBase64(file);
            setImageUrl(base64);
        }
    };
    
    const clearDraft = () => {
        const keys = ['name', 'category', 'imageUrl', 'ingredients', 'steps'];
        keys.forEach(key => sessionStorage.removeItem(`${draftKey}-${key}`));
    };

    const handleCancel = () => {
        clearDraft();
        onCancel();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const ingredientsArray = ingredients.split('\n').filter(line => line.trim() !== '');
        if (!name || !category || !imageUrl || ingredientsArray.length === 0 || !steps) {
            alert('يرجى ملء جميع الحقول.');
            return;
        }
        onSave({ name, category, imageUrl, ingredients: ingredientsArray, steps }, initialRecipe?.id);
        clearDraft();
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
                <button type="button" onClick={handleCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">إلغاء</button>
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
    const draftKey = `ad-form-draft-${initialAd?.id || 'new'}`;
    const [title, setTitle] = useSessionStorage(draftKey + '-title', initialAd?.title || '');
    const [description, setDescription] = useSessionStorage(draftKey + '-description', initialAd?.description || '');
    const [link, setLink] = useSessionStorage(draftKey + '-link', initialAd?.link || '');
    const [imageUrl, setImageUrl] = useSessionStorage(draftKey + '-imageUrl', initialAd?.imageUrl || '');
    const [imagePreview, setImagePreview] = useState(initialAd?.imageUrl || '');

    useEffect(() => {
        if(initialAd?.imageUrl) setImagePreview(initialAd.imageUrl);
    }, [initialAd]);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImagePreview(URL.createObjectURL(file));
            const base64 = await fileToBase64(file);
            setImageUrl(base64);
        }
    };
    
    const clearDraft = () => {
        const keys = ['title', 'description', 'link', 'imageUrl'];
        keys.forEach(key => sessionStorage.removeItem(`${draftKey}-${key}`));
    };
    
    const handleCancel = () => {
        clearDraft();
        onCancel();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !description || !link || !imageUrl) {
            alert('يرجى ملء جميع الحقول.');
            return;
        }
        onSave({ title, description, link, imageUrl }, initialAd?.id);
        clearDraft();
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
                <button type="button" onClick={handleCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">إلغاء</button>
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
        try {
            await onSettingsSave(localSettings);
        } catch (error) {
            // Error is handled by a toast in the parent component
        }
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

        } catch (error) {
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
    const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([]);

    const [isLegacyDataFormat, setIsLegacyDataFormat] = useState(false);
    const [existingGistFilenames, setExistingGistFilenames] = useState<string[]>([]);

    // --- TOAST NOTIFICATIONS ---
    const addToast = (message: string, type: ToastMessage['type']) => {
        setToasts(prevToasts => [...prevToasts, { id: Date.now(), message, type }]);
    };
    const removeToast = (id: number) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    };

    // --- DATA HANDLING ---
    const fetchAndApplyGistData = async (gistUrl: string, localPat: string) => {
        const gistId = getGistIdFromUrl(gistUrl);
        if (!gistId) throw new Error("الرابط Gist المحدد في الإعدادات غير صالح.");
        
        console.log(`Fetching Gist content from ID: ${gistId}`);
        const fetchOptions: RequestInit = { cache: 'reload' };
        if (localPat) {
            fetchOptions.headers = { 'Authorization': `token ${localPat}` };
        }

        const gistDetailsResponse = await fetch(`https://api.github.com/gists/${gistId}?_=${new Date().getTime()}`, fetchOptions);
        if (!gistDetailsResponse.ok) {
            if (gistDetailsResponse.status === 404) throw new Error("لم يتم العثور على Gist. تحقق من صحة الرابط.");
            if (gistDetailsResponse.status === 401 || gistDetailsResponse.status === 403) throw new Error("رمز الوصول (PAT) غير صحيح أو منتهي الصلاحية أو لا يمتلك الصلاحيات اللازمة.");
            throw new Error(`فشل في جلب تفاصيل Gist: ${gistDetailsResponse.statusText}`);
        }
        
        const gistData = await gistDetailsResponse.json();
        const remoteTimestamp = gistData.updated_at;
        const files = gistData?.files;
        if (!files) throw new Error("Gist was found, but it appears to be empty.");

        setExistingGistFilenames(Object.keys(files));
        
        let recipesFromGist, adsFromGist, settingsFromGist;
        const GIST_V0_SINGLE_FILE = 'recipe-studio-data.json';
        const GIST_V1_SETTINGS = 'settings.json';
        const GIST_V1_RECIPES = 'recipes.json';
        const GIST_V1_ADS = 'ads.json';
        const GIST_V2_MANIFEST = '_manifest.json';
        const GIST_V2_SETTINGS = '_settings.json';
        
        if (files?.[GIST_V2_MANIFEST]) {
            setIsLegacyDataFormat(false);
            const manifestContent = await fetchJsonWithCacheBust(files[GIST_V2_MANIFEST].raw_url, localPat);
            const settingsContent = await fetchJsonWithCacheBust(files[GIST_V2_SETTINGS].raw_url, localPat);
            const recipePromises = (manifestContent.recipeFiles || []).map((filename: string) => files[filename] ? fetchJsonWithCacheBust(files[filename].raw_url, localPat) : Promise.resolve(null));
            const adPromises = (manifestContent.adFiles || []).map((filename: string) => files[filename] ? fetchJsonWithCacheBust(files[filename].raw_url, localPat) : Promise.resolve(null));
            recipesFromGist = (await Promise.all(recipePromises)).filter(Boolean);
            adsFromGist = (await Promise.all(adPromises)).filter(Boolean);
            settingsFromGist = settingsContent;
        } else if (files?.[GIST_V1_RECIPES]) {
            setIsLegacyDataFormat(true);
            const fetchFile = (filename: string) => files[filename] ? fetchJsonWithCacheBust(files[filename].raw_url, localPat) : Promise.resolve(null);
            [settingsFromGist, recipesFromGist, adsFromGist] = await Promise.all([fetchFile(GIST_V1_SETTINGS), fetchFile(GIST_V1_RECIPES), fetchFile(GIST_V1_ADS)]);
        } else if (files?.[GIST_V0_SINGLE_FILE]) {
            setIsLegacyDataFormat(true);
            const data = await fetchJsonWithCacheBust(files[GIST_V0_SINGLE_FILE].raw_url, localPat);
            recipesFromGist = data.recipes;
            adsFromGist = data.ads;
            settingsFromGist = data.settings;
        } else {
            throw new Error("Could not find any recognizable data files in the Gist.");
        }
        
        const finalRecipes = recipesFromGist ?? [];
        const finalAds = adsFromGist ?? [];
        const finalSettings = { ...initialSettings, ...(settingsFromGist || {}), gistUrl, githubPat: localPat };

        setRecipes(finalRecipes);
        setAds(finalAds);
        setSettings(finalSettings);

        localStorage.setItem('recipes', JSON.stringify(finalRecipes));
        localStorage.setItem('ads', JSON.stringify(finalAds));
        localStorage.setItem('settings', JSON.stringify(finalSettings));
        localStorage.setItem('dataTimestamp', remoteTimestamp);

        console.log("Successfully fetched and applied remote Gist data.");
    };

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);

            let localSettings: Settings | null = null;
            try {
                const settingsRaw = localStorage.getItem('settings');
                if (settingsRaw) localSettings = JSON.parse(settingsRaw);
                
                setRecipes(JSON.parse(localStorage.getItem('recipes') || '[]'));
                setAds(JSON.parse(localStorage.getItem('ads') || '[]'));
                setSettings(localSettings ?? initialSettings);
                
                console.log("Loaded initial data from local storage.");
            } catch (e) {
                console.warn("Could not read local storage, starting with empty state.", e);
                setRecipes([]);
                setAds([]);
                setSettings(initialSettings);
            }

            const gistUrl = localSettings?.gistUrl || initialSettings.gistUrl;
            if (!gistUrl) {
                console.log("No Gist URL configured. App is in local-only mode.");
                setIsLoading(false);
                return;
            }

            try {
                const localTimestamp = localStorage.getItem('dataTimestamp');
                const localPat = localSettings?.githubPat || '';
                const gistId = getGistIdFromUrl(gistUrl);
                if (!gistId) {
                    addToast("الرابط Gist المحدد في الإعدادات غير صالح.", 'error');
                    setIsLoading(false);
                    return;
                }
                
                const fetchOptions: RequestInit = { cache: 'reload' };
                if (localPat) {
                    fetchOptions.headers = { 'Authorization': `token ${localPat}` };
                }

                const gistDetailsResponse = await fetch(`https://api.github.com/gists/${gistId}?_=${new Date().getTime()}`, fetchOptions);
                if (!gistDetailsResponse.ok) {
                    if (gistDetailsResponse.status === 404) throw new Error("لم يتم العثور على Gist. تحقق من صحة الرابط.");
                    if (gistDetailsResponse.status === 401 || gistDetailsResponse.status === 403) throw new Error("رمز الوصول (PAT) غير صحيح أو منتهي الصلاحية أو لا يمتلك الصلاحيات اللازمة.");
                    throw new Error(`فشل في جلب تفاصيل Gist: ${gistDetailsResponse.statusText}`);
                }
                
                const gistData = await gistDetailsResponse.json();
                const remoteTimestamp = gistData.updated_at;

                if (localTimestamp && remoteTimestamp && new Date(localTimestamp) > new Date(remoteTimestamp)) {
                    console.warn("Local data is newer than remote. Keeping local changes.");
                    addToast("لديك تغييرات محلية لم تتم مزامنتها. احفظ الإعدادات لمزامنتها.", 'error');
                    setIsLoading(false);
                    return;
                }

                if (remoteTimestamp && (!localTimestamp || new Date(remoteTimestamp) > new Date(localTimestamp))) {
                    console.log("Remote data is newer or local is missing. Fetching Gist content...");
                    await fetchAndApplyGistData(gistUrl, localPat);
                } else {
                    console.log("Local data is already up-to-date with remote.");
                }

            } catch (error) {
                let errorMessage = "فشل تحميل البيانات من الرابط.";
                if (error instanceof Error) {
                    if (error.message.includes('Failed to fetch')) errorMessage = "حدث خطأ في الشبكة.";
                    else errorMessage = error.message;
                }
                addToast(`${errorMessage} سيتم عرض البيانات المحفوظة محليًا.`, 'error');
                console.error("Remote data loading error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);


    const saveAndSync = async (newRecipes: Recipe[], newAds: Ad[], newSettings: Settings) => {
        const { gistUrl, githubPat } = newSettings;
        const gistId = getGistIdFromUrl(gistUrl);

        if (gistId && githubPat) {
            console.log(`Attempting to sync with Gist ID: ${gistId}`);
            
            const recipeFiles = newRecipes.reduce((acc, recipe) => {
                acc[`recipe_${recipe.id}.json`] = { content: JSON.stringify(recipe, null, 2) };
                return acc;
            }, {} as { [key: string]: { content: string } });

            const adFiles = newAds.reduce((acc, ad) => {
                acc[`ad_${ad.id}.json`] = { content: JSON.stringify(ad, null, 2) };
                return acc;
            }, {} as { [key: string]: { content: string } });

            const manifest = {
                version: 2,
                createdAt: new Date().toISOString(),
                recipeFiles: Object.keys(recipeFiles),
                adFiles: Object.keys(adFiles),
            };

            const filesToSync: {[key: string]: { content: string } | null} = {
                '_manifest.json': { content: JSON.stringify(manifest, null, 2) },
                '_settings.json': { content: JSON.stringify(newSettings, null, 2) },
                ...recipeFiles,
                ...adFiles,
            };

            // Determine which files to delete from the Gist
            const currentFilenames = new Set(Object.keys(filesToSync));
            existingGistFilenames.forEach(filename => {
                if (!currentFilenames.has(filename) && (filename.startsWith('recipe_') || filename.startsWith('ad_') || filename.startsWith('_'))) {
                    filesToSync[filename] = null; // Setting to null deletes the file in the Gist
                }
            });

            // If migrating from an old format, delete the old files
            if(isLegacyDataFormat){
                filesToSync['recipe-studio-data.json'] = null;
                filesToSync['recipes.json'] = null;
                filesToSync['ads.json'] = null;
                filesToSync['settings.json'] = null;
            }

            try {
                const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `token ${githubPat}`,
                        'Accept': 'application/vnd.github.v3+json',
                    },
                    body: JSON.stringify({
                        description: `Recipe Studio Data - Last updated ${new Date().toLocaleString()}`,
                        files: filesToSync,
                    }),
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    const errorMessage = errorData.message || 'فشل غير معروف.';
                    throw new Error(`خطأ في المزامنة مع GitHub: ${errorMessage} (Status: ${res.status})`);
                }
                
                const responseData = await res.json();
                localStorage.setItem('dataTimestamp', responseData.updated_at);
                setExistingGistFilenames(Object.keys(responseData.files));
                setIsLegacyDataFormat(false);
                addToast('تمت مزامنة البيانات بنجاح!', 'success');
                console.log('Successfully synced data with Gist.');

            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                addToast(message, 'error');
                console.error("Sync failed:", error);
                throw error; // Re-throw to be caught by the calling function
            }
        } else {
             addToast('تم الحفظ محليًا فقط. أدخل Gist URL و PAT للمزامنة.', 'error');
             console.log("Gist URL or PAT not provided. Saving locally only.");
        }

        // Always update state and local storage regardless of sync outcome
        setRecipes(newRecipes);
        setAds(newAds);
        setSettings(newSettings);
        localStorage.setItem('recipes', JSON.stringify(newRecipes));
        localStorage.setItem('ads', JSON.stringify(newAds));
        localStorage.setItem('settings', JSON.stringify(newSettings));
    };

    // --- CRUD OPERATIONS ---
    const saveRecipe = async (recipeData: Omit<Recipe, 'id'>, id?: string) => {
        let updatedRecipes;
        if (id) {
            updatedRecipes = recipes.map(r => r.id === id ? { ...r, ...recipeData } : r);
        } else {
            const newRecipe = { ...recipeData, id: new Date().getTime().toString() };
            updatedRecipes = [...recipes, newRecipe];
        }
        await saveAndSync(updatedRecipes, ads, settings);
        setModalState(null);
    };

    const deleteRecipe = async (id: string) => {
        const updatedRecipes = recipes.filter(r => r.id !== id);
        await saveAndSync(updatedRecipes, ads, settings);
    };

    const saveAd = async (adData: Omit<Ad, 'id'>, id?: string) => {
        let updatedAds;
        if (id) {
            updatedAds = ads.map(a => a.id === id ? { ...a, ...adData } : a);
        } else {
            const newAd = { ...adData, id: new Date().getTime().toString() };
            updatedAds = [...ads, newAd];
        }
        await saveAndSync(recipes, updatedAds, settings);
        setModalState(null);
    };

    const deleteAd = async (id: string) => {
        const updatedAds = ads.filter(a => a.id !== id);
        await saveAndSync(recipes, updatedAds, settings);
    };

    const handleSettingsSave = async (newSettings: Settings) => {
        await saveAndSync(recipes, ads, newSettings);
    };
    
    const handleCredentialsSave = (newCreds: AdminCredentials) => {
        setAdminCredentials(newCreds);
    };

    const handleImagesOptimized = async (newRecipes: Recipe[], newAds: Ad[]) => {
        await saveAndSync(newRecipes, newAds, settings);
    };


    // --- AUTHENTICATION ---
    const handleLogin = (user: string, pass: string) => {
        if (user === adminCredentials.username && pass === adminCredentials.password) {
            setIsLoggedIn(true);
            setModalState(null);
        } else {
            alert('اسم المستخدم أو كلمة المرور غير صحيحة.');
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setView('home');
    };

    // --- DATA IMPORT/EXPORT ---
    const handleExportData = () => {
        const dataToExport = {
            recipes,
            ads,
            settings,
        };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recipe-studio-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedData = JSON.parse(event.target?.result as string);
                    if (importedData.recipes && importedData.ads && importedData.settings) {
                        if (window.confirm('هل أنت متأكد من أنك تريد استبدال جميع البيانات الحالية بالبيانات الموجودة في هذا الملف؟')) {
                           await saveAndSync(importedData.recipes, importedData.ads, importedData.settings);
                           addToast('تم استيراد البيانات بنجاح!', 'success');
                        }
                    } else {
                        addToast('ملف الاستيراد غير صالح.', 'error');
                    }
                } catch (error) {
                    addToast('حدث خطأ أثناء قراءة الملف.', 'error');
                    console.error(error);
                }
            };
            reader.readAsText(file);
        }
    };

    // --- UI LOGIC ---
    const filteredRecipes = useMemo(() => {
        if (selectedCategory === 'الكل') return recipes;
        return recipes.filter(r => r.category === selectedCategory);
    }, [recipes, selectedCategory]);

    const handleViewRecipe = (recipe: Recipe) => {
        if (settings.youtubeSubscribeLink && !isSubscribed) {
            setModalState({ type: 'subscribeToView', recipe });
        } else {
            setModalState({ type: 'viewRecipe', recipe });
        }
    };

    // --- RENDER ---
    const renderModalContent = () => {
        if (!modalState) return null;

        switch (modalState.type) {
            case 'addRecipe':
            case 'editRecipe':
                return <RecipeForm initialRecipe={modalState.type === 'editRecipe' ? modalState.recipe : modalState.initialData} onSave={saveRecipe} onCancel={() => setModalState(null)} />;
            case 'viewRecipe':
                return <RecipeDetailView recipe={modalState.recipe} onDownload={() => downloadRecipeAsText(modalState.recipe)} onPrint={() => window.print()} />;
            case 'addAd':
            case 'editAd':
                return <AdForm initialAd={modalState.type === 'editAd' ? modalState.ad : null} onSave={saveAd} onCancel={() => setModalState(null)} />;
            case 'login':
                return <LoginModalContent onLogin={handleLogin} onCancel={() => setModalState(null)} />;
            case 'subscribeToView':
                 return <SubscribeModalContent 
                            subscribeUrl={settings.youtubeSubscribeLink}
                            onCancel={() => setModalState(null)}
                            onProceed={() => {
                                setIsSubscribed(true);
                                setModalState({ type: 'viewRecipe', recipe: modalState.recipe });
                            }}
                        />;
            default:
                return null;
        }
    };

    const getModalTitle = () => {
        if (!modalState) return '';
        switch (modalState.type) {
            case 'addRecipe': return 'إضافة وصفة جديدة';
            case 'editRecipe': return `تعديل: ${modalState.recipe.name}`;
            case 'viewRecipe': return modalState.recipe.name;
            case 'addAd': return 'إضافة إعلان جديد';
            case 'editAd': return `تعديل إعلان: ${modalState.ad.title}`;
            case 'login': return 'تسجيل الدخول للمدير';
            case 'subscribeToView': return `الوصول إلى وصفة: ${modalState.recipe.name}`;
            default: return '';
        }
    };

    const renderView = () => {
        if (isLoading) {
            return <div className="text-center py-20 text-gray-500">جاري تحميل البيانات...</div>;
        }

        switch (view) {
            case 'home':
                return (
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="md:grid md:grid-cols-12 md:gap-8">
                            <main className="md:col-span-9">
                                 <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-3xl font-bold text-gray-800">الوصفات</h2>
                                    {isLoggedIn && (
                                        <button onClick={() => setModalState({ type: 'addRecipe' })} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700">
                                            <PlusIcon className="w-5 h-5 me-2"/>
                                            إضافة وصفة جديدة
                                        </button>
                                    )}
                                </div>
                                <CategoryFilter recipes={recipes} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
                                {filteredRecipes.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredRecipes.map(recipe => (
                                            <RecipeCard 
                                                key={recipe.id}
                                                recipe={recipe}
                                                onView={() => handleViewRecipe(recipe)}
                                                onEdit={() => setModalState({ type: 'editRecipe', recipe })}
                                                onDelete={() => { if(window.confirm(`هل أنت متأكد من حذف وصفة "${recipe.name}"؟`)) deleteRecipe(recipe.id) }}
                                                isAdmin={isLoggedIn}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-white rounded-lg shadow">
                                        <p className="text-gray-500">لا توجد وصفات في هذا التصنيف.</p>
                                    </div>
                                )}
                            </main>
                            <aside className="md:col-span-3 mt-8 md:mt-0">
                                <div className="sticky top-24 space-y-6">
                                    <h3 className="text-xl font-bold text-gray-800">إعلانات</h3>
                                    {ads.map(ad => <AdCard key={ad.id} ad={ad} />)}
                                </div>
                            </aside>
                        </div>
                    </div>
                );
            case 'about':
                return <AboutView description={settings.siteDescription} />;
            case 'manageAds':
                return isLoggedIn ? <ManageAdsView ads={ads} setModalState={setModalState} deleteAd={deleteAd} /> : null;
            case 'settings':
                return isLoggedIn ? <SettingsView 
                    settings={settings}
                    credentials={adminCredentials}
                    recipes={recipes}
                    ads={ads}
                    onSettingsSave={handleSettingsSave}
                    onCredentialsSave={handleCredentialsSave}
                    onExport={handleExportData}
                    onImport={handleImportData}
                    onImagesOptimized={handleImagesOptimized}
                /> : null;
            default:
                return null;
        }
    };
    
    return (
        <div className="bg-gray-50 min-h-screen">
            <Header 
                settings={settings} 
                setView={setView} 
                currentView={view} 
                isLoggedIn={isLoggedIn}
                onLoginClick={() => setModalState({ type: 'login' })}
                onLogoutClick={handleLogout}
            />
            <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
            {renderView()}
            <Modal isOpen={!!modalState} onClose={() => setModalState(null)} title={getModalTitle()}>
                {renderModalContent()}
            </Modal>
        </div>
    );
};

export default App;
