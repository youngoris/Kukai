import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  Keyboard,
  Alert,
  ScrollView,
  Image,
  TouchableWithoutFeedback,
} from "react-native";
import {
  MaterialIcons,
  Feather,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import Markdown from "react-native-markdown-display"; // Import Markdown component
import useWeather from "../utils/useWeather"; // Import weather Hook
import { getTemplateContent } from "../constants/JournalTemplates"; // Import template functionality

const JournalEditScreen = ({ navigation, route }) => {
  const {
    savedJournal,
    date,
    viewOnly = false,
    location: routeLocation,
    weather: routeWeather,
    temperature: routeTemperature,
    mood: routeMood,
  } = route.params;
  const [journalText, setJournalText] = useState(savedJournal || "");
  const [location, setLocation] = useState(routeLocation || "");
  const [weather, setWeather] = useState(routeWeather || "");
  const [temperature, setTemperature] = useState(routeTemperature || null);
  const [mood, setMood] = useState(routeMood || null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false); // Add template menu state
  const [currentTemplate, setCurrentTemplate] = useState("default"); // Add current template state

  // Use custom Hook to get weather data, but don't fetch automatically
  const { fetchWeather: fetchWeatherData, getWeatherIcon } = useWeather({
    autoFetch: false,
  });

  // Keyboard listener
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      (event) => {
        setKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates.height);
      },
    );

    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Get location and weather data
  const getLocationAndWeather = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Use useWeather Hook to get weather data
      const weatherResult = await fetchWeatherData(forceRefresh);

      if (weatherResult && !weatherResult.error) {
        // Set weather data, ensure format consistency
        setWeather(weatherResult.weather);
        setTemperature(weatherResult.temperature);
        setLocation(weatherResult.location);
      } else if (weatherResult && weatherResult.error) {
        setLocationError(weatherResult.error);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setLocationError({
        type: "UNKNOWN_ERROR",
        message: "Unable to fetch location",
        details: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Modify useEffect, prioritize passed parameters
  useEffect(() => {
    const loadJournalMeta = async () => {
      try {
        const journalData = await AsyncStorage.getItem("journal");
        if (journalData) {
          const journals = JSON.parse(journalData);
          const todayJournal = journals.find((j) => j.date === date);

          if (todayJournal) {
            if (todayJournal.location) setLocation(todayJournal.location);
            if (todayJournal.weather) setWeather(todayJournal.weather);
            if (todayJournal.temperature)
              setTemperature(todayJournal.temperature);
            if (todayJournal.mood) setMood(todayJournal.mood);
          }
        }
      } catch (error) {
        console.error("Failed to load journal metadata:", error);
      }
    };

    const initialize = async () => {
      if (viewOnly) {
        // If in view mode, use passed data
        setLocation(routeLocation || "");
        setWeather(routeWeather || "");
        setTemperature(routeTemperature || null);
        setMood(routeMood || null);
        setLoading(false);
        return;
      }

      // Otherwise, try to load or get new data from AsyncStorage
      await loadJournalMeta();

      // If it's a new journal (no existing content), check if a template needs to be applied
      if (!savedJournal || savedJournal.trim() === "") {
        const settings = await AsyncStorage.getItem("userSettings");
        if (settings) {
          const parsedSettings = JSON.parse(settings);

          // Always load default template content first
          const defaultTemplateContent = getTemplateContent("default");
          setJournalText(defaultTemplateContent);

          // Then check if we need to apply a different template
          if (
            parsedSettings.selectedJournalTemplate &&
            parsedSettings.selectedJournalTemplate !== "default"
          ) {
            // Check if it's a deleted template
            if (parsedSettings.selectedJournalTemplate === "morning") {
              setCurrentTemplate("default");
            } else {
              // Apply selected template
              const templateContent = getTemplateContent(
                parsedSettings.selectedJournalTemplate,
              );
              if (templateContent) {
                setJournalText(templateContent);
                setCurrentTemplate(parsedSettings.selectedJournalTemplate);
              }
            }
          } else if (parsedSettings.selectedJournalTemplate === "custom") {
            // Apply custom template
            const customTemplate = await AsyncStorage.getItem(
              "customJournalTemplate",
            );
            if (customTemplate) {
              setJournalText(customTemplate);
              setCurrentTemplate("custom");
            }
          } else {
            setCurrentTemplate("default");
          }
        } else {
          // If no settings found, still apply default template
          const defaultTemplateContent = getTemplateContent("default");
          setJournalText(defaultTemplateContent);
          setCurrentTemplate("default");
        }
      }

      // Modify: Even if there's location or weather data, try to get latest data
      // But don't force refresh, use cache if valid
      await getLocationAndWeather(false);
    };

    initialize();
  }, []);

  // Add function to refresh weather data
  const refreshWeatherData = async () => {
    if (viewOnly) return; // Don't refresh in view mode
    await getLocationAndWeather(true); // Force refresh
  };

  // Save journal
  const saveJournal = async () => {
    if (journalText.trim() === "") {
      Alert.alert("Error", "Journal content cannot be empty");
      return;
    }

    try {
      const dateObj = new Date(date);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const previewText =
        journalText.length > 20
          ? journalText.substring(0, 20) + "..."
          : journalText;

      const title = `${formattedDate}: ${previewText}`;

      const journalEntry = {
        title: title,
        text: journalText.trim(),
        date: date,
        location: location,
        weather: weather,
        temperature: temperature,
        mood: mood,
        timestamp: new Date().toISOString(),
      };

      const journalData = await AsyncStorage.getItem("journal");
      let journals = [];

      if (journalData) {
        journals = JSON.parse(journalData);
        journals = journals.filter((entry) => entry.date !== date);
      }

      journals.push(journalEntry);

      await AsyncStorage.setItem("journal", JSON.stringify(journals));
      await AsyncStorage.setItem(`journal_${date}`, journalText.trim());

      // After saving, go to preview mode
      navigation.setParams({
        viewOnly: true,
        fromSave: true, // Mark as coming from save operation
      });
    } catch (error) {
      console.error("Failed to save journal:", error);
      Alert.alert("Error", "Failed to save. Please try again.");
    }
  };

  // Get mood icon
  const getMoodIcon = (moodType) => {
    switch (moodType) {
      case "happy":
        return "emoticon-outline";
      case "sad":
        return "emoticon-sad-outline";
      case "angry":
        return "emoticon-angry-outline";
      case "neutral":
        return "emoticon-neutral-outline";
      case "excited":
        return "emoticon-excited-outline";
      default:
        return "emoticon-outline";
    }
  };

  // Select mood
  const selectMood = (selectedMood) => {
    setMood(selectedMood);
  };

  // Custom Markdown parser configuration
  const markdownParserOptions = {
    typographer: true,
    breaks: true,
    html: true,
    linkify: true,
  };

  // Process blockquote content
  const processBlockquoteContent = (content) => {
    if (!content) return "";
    // Remove '>' symbol from blockquote
    return content.replace(/^>\s*/gm, "").trim();
  };

  // Custom image processing function
  const handleImageUri = (uri) => {
    console.log("Processing image URI:", uri);
    return uri;
  };

  // Markdown styles
  const markdownStyles = {
    body: {
      color: "#FFF",
      fontSize: 16,
      lineHeight: 24,
      fontFamily: Platform.OS === "ios" ? "PingFang SC" : "sans-serif",
    },
    // Title - Use heading1, heading2, etc. keys
    heading1: {
      color: "#FFF",
      fontSize: 28,
      fontWeight: "bold",
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: "#444",
      lineHeight: 36,
      marginVertical: 15,
      fontFamily: Platform.OS === "ios" ? "PingFang SC" : "sans-serif",
    },
    heading2: {
      color: "#FFF",
      fontSize: 24,
      fontWeight: "bold",
      marginVertical: 12,
      lineHeight: 32,
      borderBottomWidth: 0.5,
      borderBottomColor: "#444",
      paddingBottom: 3,
    },
    heading3: {
      color: "#FFF",
      fontSize: 20,
      fontWeight: "bold",
      marginVertical: 10,
      lineHeight: 28,
    },
    heading4: {
      color: "#FFF",
      fontSize: 18,
      fontWeight: "bold",
      marginVertical: 8,
      lineHeight: 26,
    },
    heading5: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "bold",
      marginVertical: 6,
      lineHeight: 24,
    },
    heading6: {
      color: "#FFF",
      fontSize: 14,
      fontWeight: "bold",
      fontStyle: "italic",
      marginVertical: 4,
      lineHeight: 22,
    },
    // Other elements
    paragraph: {
      color: "#FFF",
      fontSize: 16,
      lineHeight: 24,
      marginVertical: 8,
    },
    // Modify list item styles
    bullet_list: {
      marginLeft: 10,
      marginVertical: 8,
    },
    ordered_list: {
      marginLeft: 10,
      marginVertical: 8,
    },
    // React Native Markdown Display uses these keys
    bullet_list_item: {
      color: "#FFF",
      fontSize: 16,
      lineHeight: 24,
      marginVertical: 4,
      flexDirection: "row",
      alignItems: "center",
    },
    ordered_list_item: {
      color: "#FFF",
      fontSize: 16,
      lineHeight: 24,
      marginVertical: 4,
      flexDirection: "row",
      alignItems: "center",
    },
    bullet_list_content: {
      flex: 1,
      color: "#FFF",
    },
    ordered_list_content: {
      flex: 1,
      color: "#FFF",
    },
    bullet_list_icon: {
      marginRight: 8,
      alignSelf: "center",
    },
    ordered_list_icon: {
      marginRight: 8,
      alignSelf: "center",
    },
    strong: {
      fontWeight: "bold",
      color: "#FFF",
    },
    em: {
      fontStyle: "italic",
      color: "#FFF",
    },
    link: {
      color: "#5E9EFF",
      textDecorationLine: "underline",
    },
    code_inline: {
      backgroundColor: "#333",
      color: "#FFD700",
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      padding: 5,
      borderRadius: 3,
      fontSize: 14,
      borderColor: "#444",
      // borderWidth:1,
    },
    code_block: {
      backgroundColor: "#222",
      padding: 10,
      borderRadius: 3,
      color: "#FFD700",
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      marginVertical: 10,
      borderWidth: 1,
      borderColor: "#333",
    },
    fence: {
      backgroundColor: "#222",
      padding: 10,
      borderRadius: 3,
      color: "#FFD700",
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      marginVertical: 10,
      borderWidth: 1,
      borderColor: "#333",
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: "#666",
      paddingLeft: 10,
      paddingVertical: 5,
      backgroundColor: "#222",
      borderRadius: 3,
      color: "#CCC",
      fontStyle: "italic",
      marginVertical: 10,
    },
    hr: {
      backgroundColor: "#444",
      height: 1,
      marginVertical: 15,
    },
    table: {
      borderWidth: 1,
      borderColor: "#444",
      borderRadius: 3,
      marginVertical: 10,
    },
    thead: {
      backgroundColor: "#222",
      borderBottomWidth: 1,
      borderBottomColor: "#444",
    },
    th: {
      padding: 8,
      color: "#FFF",
      fontWeight: "bold",
      fontSize: 14,
    },
    tbody: {},
    tr: {
      borderBottomWidth: 0.5,
      borderBottomColor: "#333",
      flexDirection: "row",
    },
    td: {
      padding: 8,
      color: "#FFF",
      fontSize: 14,
    },
    image: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 8,
      marginVertical: 15,
      alignSelf: "center",
    },
  };

  // Create custom rendering rules
  const markdownRules = {
    heading1: (node, children, parent, styles) => (
      <View key={node.key} style={{ width: "100%" }}>
        <Text
          style={[styles.heading1, { textAlign: "left", letterSpacing: 0.5 }]}
        >
          {children}
        </Text>
      </View>
    ),
    heading2: (node, children, parent, styles) => (
      <View key={node.key} style={{ width: "100%" }}>
        <Text style={styles.heading2}>{children}</Text>
      </View>
    ),
    heading3: (node, children, parent, styles) => (
      <View key={node.key} style={{ width: "100%" }}>
        <Text style={styles.heading3}>{children}</Text>
      </View>
    ),
    heading4: (node, children, parent, styles) => (
      <View key={node.key} style={{ width: "100%" }}>
        <Text style={styles.heading4}>{children}</Text>
      </View>
    ),
    heading5: (node, children, parent, styles) => (
      <View key={node.key} style={{ width: "100%" }}>
        <Text style={styles.heading5}>{children}</Text>
      </View>
    ),
    heading6: (node, children, parent, styles) => (
      <View key={node.key} style={{ width: "100%" }}>
        <Text style={styles.heading6}>{children}</Text>
      </View>
    ),
    image: (node, children, parent, styles) => {
      // Extract attributes from node
      const { src, alt } = node.attributes || {};

      // Debug information
      console.log("Image node:", { src, alt });

      // Ensure image URL is valid
      if (!src) {
        console.log("Image source is empty");
        return null;
      }

      return (
        <View key={node.key} style={{ width: "100%", marginVertical: 15 }}>
          <View
            style={{
              width: "100%",
              // backgroundColor: '#1A1A1A',
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <Image
              source={{ uri: src }}
              style={{
                width: "100%",
                height: undefined,
                aspectRatio: 1,
                resizeMode: "contain",
              }}
              accessible={true}
              accessibilityLabel={alt || "Image"}
            />
          </View>
          {alt && (
            <Text
              style={{
                color: "#999",
                fontSize: 12,
                marginTop: 5,
                textAlign: "center",
              }}
            >
              {alt}
            </Text>
          )}
        </View>
      );
    },
    fence: (node, children, parent, styles) => {
      return (
        <View
          key={node.key}
          style={[styles.fence, { marginVertical: 10, width: "100%" }]}
        >
          <Text
            style={{
              color: "#FFD700",
              fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
            }}
          >
            {node.content}
          </Text>
        </View>
      );
    },
    blockquote: (node, children, parent, styles) => {
      // Ensure blockquote content is displayed correctly
      console.log("Blockquote node:", node);

      // Try to extract content from node
      let content = "";
      if (node.content) {
        content = processBlockquoteContent(node.content);
      } else if (node.children && node.children.length > 0) {
        // Try to extract content from child nodes
        content = node.children
          .map((child) => {
            if (typeof child === "string") return child;
            return child.content || "";
          })
          .join(" ");
        content = processBlockquoteContent(content);
      }

      return (
        <View key={node.key} style={styles.blockquote}>
          {children && children.length > 0 ? (
            children
          ) : content ? (
            <Text style={{ color: "#CCC", fontStyle: "italic" }}>
              {content}
            </Text>
          ) : (
            <Text style={{ color: "#CCC", fontStyle: "italic" }}>
              Quote content
            </Text>
          )}
        </View>
      );
    },
    code_block: (node, children, parent, styles) => {
      return (
        <View
          key={node.key}
          style={[styles.code_block, { marginVertical: 10, width: "100%" }]}
        >
          <Text
            style={{
              color: "#FFD700",
              fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
            }}
          >
            {node.content}
          </Text>
        </View>
      );
    },
    bullet_list_item: (node, children, parent, styles) => {
      return (
        <View key={node.key} style={styles.bullet_list_item}>
          <View style={styles.bullet_list_icon}>
            <Text style={{ color: "#FFF", fontSize: 16 }}>•</Text>
          </View>
          <View style={styles.bullet_list_content}>{children}</View>
        </View>
      );
    },
    ordered_list_item: (node, children, parent, styles, inheritedProps) => {
      const number = inheritedProps?.index || 1;
      return (
        <View key={node.key} style={styles.ordered_list_item}>
          <View style={styles.ordered_list_icon}>
            <Text style={{ color: "#FFF", fontSize: 16 }}>{number}.</Text>
          </View>
          <View style={styles.ordered_list_content}>{children}</View>
        </View>
      );
    },
  };

  // Preprocess Markdown before displaying
  useEffect(() => {
    if (viewOnly && journalText) {
      // Find all image markers
      const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
      const matches = [...journalText.matchAll(imgRegex)];

      if (matches.length > 0) {
        console.log("Found images in text:", matches.length);
        matches.forEach((match, index) => {
          const [fullMatch, alt, url] = match;
          console.log(`Image ${index + 1}:`, { alt, url });
        });
      }
    }
  }, [viewOnly, journalText]);

  // Add function to apply template
  const applyTemplate = async (templateId) => {
    if (viewOnly) return; // Don't apply template in view mode

    // Prevent applying deleted templates
    if (templateId === "morning") {
      return;
    }

    // If current editor has content, prompt for confirmation
    if (journalText.trim() !== "") {
      Alert.alert(
        "Apply Template",
        "This will replace your current text. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Apply",
            onPress: () => {
              if (templateId === "custom") {
                applyCustomTemplate();
              } else {
                const templateContent = getTemplateContent(templateId);
                if (templateContent) {
                  setJournalText(templateContent);
                  setCurrentTemplate(templateId);
                }
              }
              setShowTemplateMenu(false);
            },
          },
        ],
      );
    } else {
      // If no content, apply directly
      if (templateId === "custom") {
        applyCustomTemplate();
      } else {
        const templateContent = getTemplateContent(templateId);
        if (templateContent) {
          setJournalText(templateContent);
          setCurrentTemplate(templateId);
        }
      }
      setShowTemplateMenu(false);
    }
  };

  // Helper function to apply custom template
  const applyCustomTemplate = async () => {
    try {
      const customTemplate = await AsyncStorage.getItem(
        "customJournalTemplate",
      );
      if (customTemplate) {
        setJournalText(customTemplate);
        setCurrentTemplate("custom");
      }
    } catch (error) {
      console.error("Error applying custom template:", error);
    }
  };

  // Add template menu rendering function
  const renderTemplateMenu = () => {
    if (!showTemplateMenu) return null;

    const templates = [
      { id: "default", name: "Default" },
      { id: "gratitude", name: "Gratitude" },
      { id: "reflection", name: "Reflection" },
      { id: "achievement", name: "Achievement" },
      { id: "evening", name: "Evening" },
      { id: "detailed", name: "Detailed" },
      { id: "custom", name: "Custom" },
    ];

    return (
      <TouchableWithoutFeedback onPress={() => setShowTemplateMenu(false)}>
        <View style={styles.templateOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.templateMenuContainer}>
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateOption}
                  onPress={() => applyTemplate(template.id)}
                >
                  <View style={styles.templateOptionTextContainer}>
                    {currentTemplate === template.id && (
                      <Text style={styles.templateOptionDot}>•</Text>
                    )}
                    <Text style={styles.templateOptionText}>
                      {template.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />

      {/* Top navigation bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (viewOnly) {
              // In view mode, use goBack() instead of navigate
              navigation.goBack();
            } else {
              // Normal return in edit mode
              navigation.goBack();
            }
          }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {viewOnly ? "Journal Review" : "Edit Journal"}
        </Text>
        {!viewOnly && (
          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity
              style={styles.templateButton}
              onPress={() => setShowTemplateMenu(!showTemplateMenu)}
            >
              <Feather name="file-text" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={{ marginLeft: 16 }} onPress={saveJournal}>
              <MaterialIcons name="check" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
        {viewOnly && (
          <TouchableOpacity
            onPress={() => {
              navigation.setParams({
                viewOnly: false,
              });
            }}
          >
            <MaterialIcons name="edit" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Template menu */}
      {renderTemplateMenu()}

      {/* Date and mood display - Only show in view mode */}
      {viewOnly && (
        <View style={styles.dateContainer}>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>
              {new Date(date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
            {mood && (
              <MaterialCommunityIcons
                name={getMoodIcon(mood)}
                size={20}
                color="#FFFFFF"
                style={styles.dateMoodIcon}
              />
            )}
          </View>
        </View>
      )}

      {/* Main input/display area */}
      {viewOnly ? (
        <ScrollView
          style={styles.contentScrollView}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <Markdown
            style={markdownStyles}
            rules={markdownRules}
            options={{
              typographer: true,
              breaks: true,
              html: true,
              linkify: true,
            }}
            mergeStyle={true}
            allowedImageHandlers={[
              "data:image/png;base64",
              "data:image/gif;base64",
              "data:image/jpeg;base64",
              "https://",
              "http://",
            ]}
            defaultImageHandler={"https://"}
          >
            {journalText}
          </Markdown>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: keyboardVisible ? keyboardHeight + 60 : 20,
          }}
        >
          <TextInput
            style={styles.editor}
            multiline
            autoFocus
            keyboardAppearance="dark"
            placeholder="Write your journal entry here... (supports markdown)"
            placeholderTextColor="#666"
            value={journalText}
            onChangeText={setJournalText}
          />
        </ScrollView>
      )}

      {/* Bottom display area */}
      <View
        style={[
          styles.infoBar,
          keyboardVisible && !viewOnly
            ? {
                position: "absolute",
                bottom: keyboardHeight,
                left: 0,
                right: 0,
                backgroundColor: "#000",
                borderTopWidth: 1,
                borderTopColor: "#222",
              }
            : {},
        ]}
      >
        {loading ? (
          <Text style={styles.loadingText}>
            Loading location and weather...
          </Text>
        ) : (
          <View style={styles.infoContainer}>
            <View style={styles.metaInfoContainer}>
              {location ? (
                <View style={styles.infoItem}>
                  <Feather name="map-pin" size={16} color="#AAAAAA" />
                  <Text
                    style={styles.infoText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {location}
                  </Text>
                </View>
              ) : locationError ? (
                <View style={styles.infoItem}>
                  <Feather name="alert-circle" size={16} color="#AAAAAA" />
                  <Text style={styles.infoText}>Location unavailable</Text>
                </View>
              ) : null}

              {weather && temperature ? (
                <View style={styles.infoItem}>
                  <MaterialCommunityIcons
                    name={`weather-${getWeatherIcon(weather)}`}
                    size={16}
                    color="#AAAAAA"
                  />
                  <Text
                    style={styles.infoText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {weather}, {temperature}°C
                  </Text>
                  {!viewOnly && (
                    <TouchableOpacity
                      onPress={refreshWeatherData}
                      style={styles.refreshButton}
                    >
                      <Feather name="refresh-cw" size={14} color="#AAAAAA" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : weather ? (
                <View style={styles.infoItem}>
                  <MaterialCommunityIcons
                    name={`weather-${getWeatherIcon(weather)}`}
                    size={16}
                    color="#AAAAAA"
                  />
                  <Text
                    style={styles.infoText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {weather}
                  </Text>
                  {!viewOnly && (
                    <TouchableOpacity
                      onPress={refreshWeatherData}
                      style={styles.refreshButton}
                    >
                      <Feather name="refresh-cw" size={14} color="#AAAAAA" />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                !viewOnly && (
                  <TouchableOpacity
                    onPress={refreshWeatherData}
                    style={styles.infoItem}
                  >
                    <Feather name="cloud" size={16} color="#AAAAAA" />
                    <Text style={styles.infoText}>Update weather</Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            {/* Keep consistent layout in preview mode */}
            {viewOnly ? (
              <View style={{ width: 90, height: 26 }} />
            ) : (
              <View style={styles.moodSelector}>
                <TouchableOpacity
                  style={styles.moodItem}
                  onPress={() => selectMood("happy")}
                >
                  <MaterialCommunityIcons
                    name="emoticon-happy-outline"
                    size={20}
                    color={mood === "happy" ? "#FFFFFF" : "#666666"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moodItem}
                  onPress={() => selectMood("calm")}
                >
                  <MaterialCommunityIcons
                    name="emoticon-neutral-outline"
                    size={20}
                    color={mood === "calm" ? "#FFFFFF" : "#666666"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moodItem}
                  onPress={() => selectMood("sad")}
                >
                  <MaterialCommunityIcons
                    name="emoticon-sad-outline"
                    size={20}
                    color={mood === "sad" ? "#FFFFFF" : "#666666"}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  editor: {
    flex: 1,
    padding: 20,
    color: "#FFF",
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
  },
  infoBar: {
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "#222",
    padding: 15,
    minHeight: 60,
  },
  infoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  metaInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    flexWrap: "nowrap",
    maxWidth: "80%",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
    flexShrink: 1,
  },
  infoText: {
    color: "#CCCCCC",
    marginLeft: 5,
    fontSize: 14,
    flexShrink: 1,
    maxWidth: 180,
  },
  loadingText: {
    color: "#AAAAAA",
    fontSize: 14,
    textAlign: "center",
  },
  dateContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    backgroundColor: "#111",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  dateMoodIcon: {
    marginLeft: 5,
  },
  moodSelector: {
    flexDirection: "row",
    alignItems: "center",
  },
  moodItem: {
    marginLeft: 5,
    padding: 3,
  },
  contentScrollView: {
    flex: 1,
    padding: 15,
    backgroundColor: "#000",
  },
  contentText: {
    color: "#FFF",
    fontSize: 16,
    lineHeight: 24,
  },
  refreshButton: {
    marginLeft: 8,
    padding: 3,
  },
  templateButton: {
    padding: 4,
  },
  templateMenuContainer: {
    position: "absolute",
    top: 100,
    right: 20,
    backgroundColor: "#262626",
    borderRadius: 8,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  templateOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  templateOptionText: {
    color: "#FFF",
    fontSize: 16,
    marginLeft: 15,
  },
  templateOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
    zIndex: 999,
  },
  templateOptionTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  templateOptionDot: {
    position: "absolute",
    left: 0,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default JournalEditScreen;
