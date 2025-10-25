
export interface Recipe {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  ingredients: string[];
  steps: string;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  link: string;
}
