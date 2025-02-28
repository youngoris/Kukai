import { SPACING, FONT_SIZE, FONT_FAMILY, COLORS } from '../constants/DesignSystem';
import { fadeIn, fadeOut, pressAnimation } from '../utils/AnimationUtils';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.l,
  },
  dateContainer: {
    alignItems: 'center',
    marginTop: SPACING.m,
    marginBottom: SPACING.xl,
  },
  dateText: {
    fontSize: FONT_SIZE.s,
    color: COLORS.text.primary,
    fontFamily: FONT_FAMILY.light,
    letterSpacing: 1,
  },
  quoteContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    width: '70%',
    alignSelf: 'center',
  },
  quoteText: {
    fontSize: FONT_SIZE.l,
    color: COLORS.text.secondary,
    fontFamily: FONT_FAMILY.regular,
    fontStyle: 'italic',
    lineHeight: FONT_SIZE.l * 1.4,
    textAlign: 'center',
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
  },
  menuItem: {
    paddingVertical: SPACING.l,
    marginVertical: SPACING.xs,
    width: '100%',
    alignItems: 'center',
  },
  menuText: {
    fontSize: FONT_SIZE.xxxl,
    fontFamily: FONT_FAMILY.bold,
    letterSpacing: 2,
    textAlign: 'center',
    color: COLORS.text.primary,
  },
  settingsContainer: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
  },
  settingsText: {
    color: COLORS.text.tertiary,
    fontSize: FONT_SIZE.s,
    marginLeft: SPACING.s,
    fontFamily: FONT_FAMILY.medium,
    letterSpacing: 1,
  },
}); 