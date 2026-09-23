import React from 'react';
import { ModernAddProductForm } from './admin/ModernAddProductForm';

export interface ProductFormProps {
  initialData?: any;
  onSuccess?: (product: any) => void;
  onCancel?: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSuccess, onCancel }) => {
  return (
    <ModernAddProductForm
      initialProduct={initialData}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
};

export default ProductForm;
