import { useMeditation } from './contexts/MeditationContext';

const HomeScreen = ({ navigation }) => {
  const { activeMeditation, formatTime } = useMeditation();
  
  const getMenuItemStyle = (menuName) => {
    const normalizedMenuName = menuName.toLowerCase();
    const isHighlighted = getCurrentHighlightedFunction() === menuName;
    const isCompleted = completedTasks[normalizedMenuName];
    const isMeditating = normalizedMenuName === 'meditation' && activeMeditation;
    
    return {
      opacity: isHighlighted ? 1 : (isCompleted && !isMeditating) ? 0.4 : 0.6,
      color: '#fff'
    };
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.menuContainer}>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => handleFunctionAccess('meditation')}
        >
          <Text style={[styles.menuText, getMenuItemStyle('MEDITATION')]}>
            MEDITATION
            {activeMeditation && (
              <Text style={styles.meditationTimer}>
                {" "}({formatTime(activeMeditation.remainingTime)})
              </Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  meditationTimer: {
    fontSize: 20,
    fontWeight: '400',
    color: '#aaa',
  },
}); 