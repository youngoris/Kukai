// Navigation utility functions

// Custom navigation function to handle direction
export const navigateWithDirection = (navigation, routeName, params = {}, fromBack = false) => {
  // If fromBack is true, it will simulate a back navigation animation
  navigation.navigate({
    name: routeName,
    params: { ...params, fromBack },
  });
};

// Helper function to go back to Home with correct animation
export const goBackToHome = (navigation, params = {}) => {
  navigateWithDirection(navigation, "Home", params, true);
}; 