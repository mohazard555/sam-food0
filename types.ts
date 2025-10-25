
export interface Recipe {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  ingredients: string[];
  steps: string;
}

export interface Ad {
  id:string;
  title: string;
  description: string;
  imageUrl: string;
  link: string;
}

export interface Settings {
  siteName: string;
  siteDescription: string;
  siteLogo: string; // Base64 encoded image
  youtubeSubscribeLink: string;
  gistUrl: string; // New field for online data sync
}

export interface AdminCredentials {
  username: string;
  password: string;
}