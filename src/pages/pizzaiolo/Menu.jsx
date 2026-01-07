import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import Card from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { usePizzaioloMenuDraft, usePizzaioloMenuEditor, useCustomIngredients } from '../../features/menu/hooks';
import {
  PizzaioloMenuCategoryTiles,
  PizzaioloMenuCommonFields,
  PizzaioloMenuDessertPresetGrid,
  PizzaioloMenuDessertCustomizer,
  PizzaioloMenuDrinkPicker,
  PizzaioloMenuDrinkTypeSelector,
  PizzaioloMenuItemList,
  PizzaioloMenuPizzaCustomizer,
  PizzaioloMenuPizzaPresetGrid,
  PizzaioloMenuCalzonePresetGrid,
} from '../../features/menu/components/pizzaiolo';

export default function PizzaioloMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const compositionRef = useRef(null);
  
  const {
    truckId,
    loading: loadingTruck,
    error: truckError,
  } = usePizzaioloTruckId(user?.uid);

  const {
    items: menuItems,
    loading: loadingMenu,
    error: menuError,
    saving,
    message,
    setMessage,
    addItem,
    deleteItem,
    setItemAvailability,
  } = usePizzaioloMenuEditor(truckId);

  const {
    customBases,
    customGarnitures,
    customFromages,
    canAddMore,
    addCustomIngredient,
    removeCustomIngredient,
  } = useCustomIngredients(user?.uid);

  const loading = loadingTruck || loadingMenu;

  const {
    showForm,
    selectedCategory,
    selectCategory,
    cancelForm,
    resetDraft,
    draft,

    itemName,
    setItemName,
    hasStartedTyping,
    isCustomMode,
    setIsCustomMode,
    itemDesc,
    setItemDesc,
    itemType,
    setItemType,

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

    drinkSizes,
    setDrinkSizes,
    selectedDrinkSize,
    setSelectedDrinkSize,

    selectedBase,
    setSelectedBase,
    selectedGarnitures,
    setSelectedGarnitures,
    selectedFromages,
    setSelectedFromages,
  } = usePizzaioloMenuDraft();

  // Remonter les erreurs de chargement de manière explicite (sans casser l'UX).
  // On ne modifie pas l'UI principale, on affiche un message si nécessaire.
  useEffect(() => {
    if (truckError) {
      setMessage('❌ Erreur chargement camion (truckId)');
    } else if (menuError) {
      setMessage('❌ Erreur chargement menu');
    }
  }, [truckError, menuError, setMessage]);

  // Auto-scroll quand on active le mode personnalisation
  useEffect(() => {
    if (isCustomMode && compositionRef.current) {
      setTimeout(() => {
        compositionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [isCustomMode]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!truckId) return;

    const result = await addItem(draft);

    if (!result?.ok) return;

    // Reset form (on garde le message de succès géré par le hook)
    resetDraft();
    // showForm est piloté par le hook: on réutilise cancelForm/juste fermer
    // Ici, on garde la même UX: on ferme le formulaire après ajout.
    cancelForm();
  };

  const handleDeleteItem = async (itemId) => {
    if (!truckId || !confirm('Supprimer cet article du menu ?')) return;

    await deleteItem(itemId);
  };

  const formatPrice = (cents) => {
    return (cents / 100).toFixed(2) + ' €';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-gray-600">Chargement du menu...</p>
      </Card>
    );
  }

  if (!truckId) {
    return (
      <Card className="p-6">
        <p className="text-gray-600">⚠️ Créez d'abord votre camion dans l'onglet "Profil"</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bouton retour */}
      <button
        onClick={() => navigate('/pro/truck')}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au tableau de bord
      </button>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📋 Mon Menu</h2>
          </div>
          {showForm && (
            <Button
              size="sm"
              onClick={() => {
                cancelForm();
              }}
              title="Annuler la création / modification en cours"
              variant="outline"
              className="rounded-2xl font-bold border-orange-500/40 text-orange-600 hover:bg-orange-500/10"
            >
              <X className="h-4 w-4" />
              Annuler
            </Button>
          )}
        </div>

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${message.includes('✅') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {message}
          </div>
        )}

        {/* Tuiles de sélection de catégorie - toujours visibles (même en mode perso) */}
        <PizzaioloMenuCategoryTiles selectedCategory={selectedCategory} onSelect={selectCategory} />

        {/* Formulaire selon la catégorie sélectionnée */}
        <PizzaioloMenuDrinkTypeSelector
          show={showForm && selectedCategory === 'boisson'}
          itemType={itemType}
          onSelectType={(type) => {
            setItemType(type);
            setItemName('');
            setSelectedDrinkSize('');
            setDrinkSizes({});
          }}
        />

        {showForm && (
          <form onSubmit={handleAddItem} className="mt-6 space-y-6 border-t pt-6">
            {/* Sélection Pizza prédéfinie */}
            <PizzaioloMenuPizzaPresetGrid
              selectedCategory={selectedCategory}
              itemName={itemName}
              hasStartedTyping={hasStartedTyping}
              onSelectPizza={(pizza) => {
                setItemName(pizza.name);
                setItemDesc(pizza.ingredients);
                if (pizza.custom) {
                  setIsCustomMode(true);
                }
              }}
            />

            {/* Sélection Calzone prédéfini */}
            <PizzaioloMenuCalzonePresetGrid
              selectedCategory={selectedCategory}
              itemName={itemName}
              hasStartedTyping={hasStartedTyping}
              onSelectCalzone={(calzone) => {
                setItemName(calzone.name);
                setItemDesc(calzone.ingredients);
                if (calzone.custom) {
                  setIsCustomMode(true);
                }
              }}
            />

            {/* Sélection Dessert prédéfini */}
            <PizzaioloMenuDessertPresetGrid
              selectedCategory={selectedCategory}
              itemName={itemName}
              onSelectDessert={(dessert) => {
                setItemName(dessert.name);
                if (dessert.defaultPrice) {
                  setPriceS(dessert.defaultPrice.toString());
                }
                if (dessert.custom) {
                  setIsCustomMode(true);
                }
              }}
            />

            <PizzaioloMenuDrinkPicker
              key={`${selectedCategory || 'none'}:${itemType || 'none'}`}
              selectedCategory={selectedCategory}
              itemType={itemType}
              itemName={itemName}
              selectedDrinkSize={selectedDrinkSize}
              priceS={priceS}
              drinkSizes={drinkSizes}
              setItemName={setItemName}
              setDrinkSizes={setDrinkSizes}
              setSelectedDrinkSize={setSelectedDrinkSize}
              setPriceS={setPriceS}
            />

            {/* Zone de composition (ref pour auto-scroll) */}
            <div ref={compositionRef}>
              <PizzaioloMenuPizzaCustomizer
                selectedCategory={selectedCategory}
                isCustomMode={isCustomMode}
                onExitCustom={() => {
                  // Revenir à la grille (pizza/calzone) sans fermer le formulaire.
                  // resetDraft remet hasStartedTyping=false, itemName='', isCustomMode=false, etc.
                  resetDraft({ keepItemType: true });
                }}
                itemName={itemName}
                setItemName={setItemName}
                selectedBase={selectedBase}
                setSelectedBase={setSelectedBase}
                selectedGarnitures={selectedGarnitures}
                setSelectedGarnitures={setSelectedGarnitures}
                selectedFromages={selectedFromages}
                setSelectedFromages={setSelectedFromages}
                customBases={customBases}
                customGarnitures={customGarnitures}
                customFromages={customFromages}
                onAddCustomIngredient={addCustomIngredient}
                onRemoveCustomIngredient={async (type, ingredient) => {
                  await removeCustomIngredient(type, ingredient);

                  // Nettoyer les sélections si on vient de supprimer un élément sélectionné.
                  const removedName = ingredient?.name;
                  if (!removedName) return;

                  if (type === 'base' && selectedBase === removedName) {
                    setSelectedBase('');
                  }

                  if (type === 'garniture') {
                    setSelectedGarnitures((prev) => prev.filter((g) => g !== removedName));
                  }

                  if (type === 'fromage') {
                    setSelectedFromages((prev) => prev.filter((f) => f !== removedName));
                  }
                }}
                canAddMore={canAddMore && canAddMore()}
              />

              <PizzaioloMenuDessertCustomizer
                selectedCategory={selectedCategory}
                isCustomMode={isCustomMode}
                onExitCustom={() => {
                  // Revenir à la grille desserts sans fermer le formulaire.
                  resetDraft({ keepItemType: true });
                }}
                itemName={itemName}
                setItemName={setItemName}
              />
            </div>

            {/* Champs communs une fois le produit sélectionné */}
            <PizzaioloMenuCommonFields
              selectedCategory={selectedCategory}
              itemType={itemType}
              itemName={itemName}
              setItemName={setItemName}
              itemDesc={itemDesc}
              setItemDesc={setItemDesc}
              isCustomMode={isCustomMode}
              priceS={priceS}
              setPriceS={setPriceS}
              priceM={priceM}
              setPriceM={setPriceM}
              priceL={priceL}
              setPriceL={setPriceL}
              diameterS={diameterS}
              setDiameterS={setDiameterS}
              diameterM={diameterM}
              setDiameterM={setDiameterM}
              diameterL={diameterL}
              setDiameterL={setDiameterL}
              drinkSizes={drinkSizes}
              setDrinkSizes={setDrinkSizes}
              selectedDrinkSize={selectedDrinkSize}
            />

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Ajout en cours...' : 'Ajouter au menu'}
            </Button>
          </form>
        )}
      </Card>

      {/* Liste des items */}
      <PizzaioloMenuItemList
        items={menuItems}
        onDelete={handleDeleteItem}
        onSetAvailability={async (itemId, available) => {
          await setItemAvailability(itemId, available);
        }}
        formatPrice={formatPrice}
      />
    </div>
  );
}
