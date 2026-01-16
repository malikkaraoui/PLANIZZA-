import { useMemo, useState } from 'react';

/**
 * Hook réutilisable: gère l'état "draft" du formulaire Menu pizzaiolo.
 * Objectif: sortir la logique métier (reset, flow boissons, pizza perso) hors des pages.
 */
export function usePizzaioloMenuDraft() {
  // UI
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null); // 'pizza'|'calzone'|'boisson'|'dessert'

  // Empêche la réapparition de la grille de sélection quand on vide l'input
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  
  // Mode composition personnalisée (pizza/calzone "Autre")
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Champs communs
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemType, setItemType] = useState('pizza');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);

  // Prix & diamètres (pizza/calzone)
  const [priceS, setPriceS] = useState('');
  const [priceM, setPriceM] = useState('');
  const [priceL, setPriceL] = useState('');
  const [diameterS, setDiameterS] = useState('26');
  const [diameterM, setDiameterM] = useState('34');
  const [diameterL, setDiameterL] = useState('44');

  // Boissons
  const [drinkSizes, setDrinkSizes] = useState({});
  const [selectedDrinkSize, setSelectedDrinkSize] = useState('');

  // Pizza personnalisée
  const [selectedBase, setSelectedBase] = useState('');
  const [selectedGarnitures, setSelectedGarnitures] = useState([]);
  const [selectedFromages, setSelectedFromages] = useState([]);

  // Wrapper pour setItemName qui track l'interaction utilisateur
  const handleSetItemName = (value) => {
    setItemName(value);
    if (!hasStartedTyping) setHasStartedTyping(true);
  };

  const resetDraft = ({ keepItemType = false } = {}) => {
    setItemName('');
    setItemDesc('');
    setHasStartedTyping(false);
    setIsCustomMode(false);
    if (!keepItemType) setItemType('pizza');
    setSelectedPhotoUrl(null);

    setPriceS('');
    setPriceM('');
    setPriceL('');

    setDiameterS('26');
    setDiameterM('34');
    setDiameterL('44');

    setDrinkSizes({});
    setSelectedDrinkSize('');

    setSelectedBase('');
    setSelectedGarnitures([]);
    setSelectedFromages([]);
  };

  const cancelForm = () => {
    setShowForm(false);
    setSelectedCategory(null);
    resetDraft({ keepItemType: true });
  };

  const selectCategory = (category) => {
    setSelectedCategory(category);
    setShowForm(true);

    // Reset sans écraser le type tout de suite
    resetDraft({ keepItemType: true });

    if (category === 'pizza') {
      setItemType('pizza');
    } else if (category === 'calzone') {
      setItemType('calzone');
    } else if (category === 'dessert') {
      setItemType('dessert');
    } else if (category === 'boisson') {
      // Important: évite d'avoir un itemType "pizza" résiduel
      // qui activerait des sections non pertinentes.
      setItemType('');
    }
  };

  const computedPersoDescription = useMemo(() => {
    if (!isCustomMode) return '';

    if (!selectedBase && selectedGarnitures.length === 0 && selectedFromages.length === 0) return '';

    const ingredients = [];
    if (selectedBase) ingredients.push(selectedBase);
    if (selectedFromages.length > 0) ingredients.push(...selectedFromages);
    if (selectedGarnitures.length > 0) ingredients.push(...selectedGarnitures);

    return ingredients.join(', ');
  }, [isCustomMode, selectedBase, selectedGarnitures, selectedFromages]);

  const effectiveDescription = computedPersoDescription || itemDesc;

  const draft = useMemo(
    () => ({
      type: itemType,
      name: itemName,
      description: effectiveDescription,
      photo: selectedPhotoUrl,
      priceS,
      priceM,
      priceL,
      diameterS,
      diameterM,
      diameterL,
      drinkSizes,
      selectedDrinkSize,
      selectedBase,
      selectedGarnitures,
      selectedFromages,
    }),
    [
      itemType,
      itemName,
      effectiveDescription,
      selectedPhotoUrl,
      priceS,
      priceM,
      priceL,
      diameterS,
      diameterM,
      diameterL,
      drinkSizes,
      selectedDrinkSize,
      selectedBase,
      selectedGarnitures,
      selectedFromages,
    ]
  );

  return {
    // UI
    showForm,
    setShowForm,
    selectedCategory,
    selectCategory,
    cancelForm,

    // Champs
    itemName,
    setItemName: handleSetItemName,
    hasStartedTyping,
    isCustomMode,
    setIsCustomMode,
    itemDesc: effectiveDescription,
    setItemDesc,
    itemType,
    setItemType,
    selectedPhotoUrl,
    setSelectedPhotoUrl,

    // Prix/tailles
    priceS,
    setPriceS,
    priceM,
    setPriceM,
    priceL,
    setPriceL,
    diameterS,
    setDiameterS,
    diameterM,
    setDiameterM,
    diameterL,
    setDiameterL,

    // Boissons
    drinkSizes,
    setDrinkSizes,
    selectedDrinkSize,
    setSelectedDrinkSize,

    // Perso
    selectedBase,
    setSelectedBase,
    selectedGarnitures,
    setSelectedGarnitures,
    selectedFromages,
    setSelectedFromages,

    // Helpers
    resetDraft,
    draft,
    computedPersoDescription,
  };
}
