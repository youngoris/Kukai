/**
 * JournalTemplateManager.js
 * Component for managing and previewing journal templates
 */

/**
 * STORAGE MIGRATION: This file has been updated to use StorageService instead of AsyncStorage.
 * StorageService is a drop-in replacement that uses SQLite under the hood for better performance.
 */

import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import storageService from "../services/StorageService";
import Markdown from "react-native-markdown-display";
import {
  AVAILABLE_TEMPLATES,
  getTemplateContent,
} from "../constants/JournalTemplates";

const JournalTemplateManager = ({ isVisible, onClose, onTemplateSelect }) => {
  const [selectedTemplate, setSelectedTemplate] = useState("default");
  const [previewContent, setPreviewContent] = useState("");
  const [customTemplate, setCustomTemplate] = useState("");
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Load custom template
  useEffect(() => {
    loadCustomTemplate();
  }, []);

  // Update preview content when selected template changes
  useEffect(() => {
    if (selectedTemplate === "custom") {
      setPreviewContent(customTemplate);
    } else {
      setPreviewContent(getTemplateContent(selectedTemplate));
    }
  }, [selectedTemplate, customTemplate]);

  // Load custom template from storage
  const loadCustomTemplate = async () => {
    try {
      const customContent = await storageService.getItem("customJournalTemplate");
      if (customContent) {
        setCustomTemplate(customContent);
      } else {
        // Initialize with a basic template
        const basicTemplate = `# Custom Journal Template

## Add your own sections here

*You can use markdown formatting*

- List items
- More items

## Add more headers as needed

`;
        setCustomTemplate(basicTemplate);
      }
    } catch (error) {
      console.error("Error loading custom template:", error);
    }
  };

  // Save custom template
  const saveCustomTemplate = async () => {
    try {
      await storageService.setItem("customJournalTemplate", customTemplate);
      Alert.alert("Success", "Custom template saved successfully");
      setIsEditingCustom(false);
    } catch (error) {
      console.error("Error saving custom template:", error);
      Alert.alert("Error", "Failed to save custom template");
    }
  };

  // Select and apply a template
  const selectTemplate = (templateId) => {
    setSelectedTemplate(templateId);

    // If in edit mode, exit it when selecting a built-in template
    if (templateId !== "custom" && isEditingCustom) {
      setIsEditingCustom(false);
    }
  };

  // Apply the currently selected template
  const applySelectedTemplate = () => {
    let templateContent;

    if (selectedTemplate === "custom") {
      templateContent = customTemplate;
    } else {
      templateContent = getTemplateContent(selectedTemplate);
    }

    if (onTemplateSelect) {
      onTemplateSelect(selectedTemplate, templateContent);
    }

    onClose();
  };

  // Edit custom template
  const editCustomTemplate = () => {
    setSelectedTemplate("custom");
    setIsEditingCustom(true);
    setShowPreview(false);
  };

  // Toggle between preview and edit mode for custom template
  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  // Markdown styles
  const markdownStyles = {
    body: {
      color: "#FFF",
      fontSize: 14,
      lineHeight: 22,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    heading1: {
      color: "#FFF",
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 10,
      marginTop: 6,
    },
    heading2: {
      color: "#FFF",
      fontSize: 18,
      fontWeight: "600",
      marginTop: 12,
      marginBottom: 8,
    },
    heading3: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "500",
      marginTop: 10,
      marginBottom: 6,
    },
    paragraph: {
      color: "#DDD",
      fontSize: 14,
      marginBottom: 10,
      lineHeight: 22,
    },
    list_item: {
      color: "#DDD",
      fontSize: 14,
      lineHeight: 22,
    },
    bullet_list: {
      marginBottom: 10,
    },
    ordered_list: {
      marginBottom: 10,
    },
    blockquote: {
      backgroundColor: "#222",
      borderLeftColor: "#555",
      borderLeftWidth: 4,
      padding: 8,
      marginBottom: 10,
    },
    em: {
      color: "#AAA",
      fontStyle: "italic",
    },
    strong: {
      color: "#FFF",
      fontWeight: "bold",
    },
    hr: {
      backgroundColor: "#333",
      height: 1,
      marginTop: 8,
      marginBottom: 8,
    },
    code_inline: {
      color: "#EEE",
      backgroundColor: "#222",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      padding: 4,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: "#222",
      padding: 8,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      marginBottom: 10,
    },
    fence: {
      backgroundColor: "#222",
      padding: 8,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      marginBottom: 10,
    },
    link: {
      color: "#3498db",
      textDecorationLine: "underline",
    },
    blockquote_text: {
      color: "#BBB",
    },
    textgroup: {
      color: "#DDD",
    },
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Journal Templates</Text>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={applySelectedTemplate}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>

          {/* Template Selection */}
          <View style={styles.templateSelectionContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {AVAILABLE_TEMPLATES.map((template) => (
                <TouchableOpacity
                  key={template.value}
                  style={[
                    styles.templateOption,
                    selectedTemplate === template.value &&
                      styles.selectedTemplateOption,
                  ]}
                  onPress={() => selectTemplate(template.value)}
                >
                  <Text
                    style={[
                      styles.templateOptionText,
                      selectedTemplate === template.value &&
                        styles.selectedTemplateOptionText,
                    ]}
                  >
                    {template.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Custom Template Edit Button */}
          {selectedTemplate === "custom" && (
            <View style={styles.customTemplateControls}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={isEditingCustom ? togglePreview : editCustomTemplate}
              >
                <Feather
                  name={isEditingCustom && showPreview ? "edit" : "eye"}
                  size={18}
                  color="#FFF"
                />
                <Text style={styles.editButtonText}>
                  {isEditingCustom && showPreview ? "Edit" : "Preview"}
                </Text>
              </TouchableOpacity>

              {isEditingCustom && (
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveCustomTemplate}
                >
                  <Feather name="save" size={18} color="#000" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Template Preview/Edit */}
          <View style={styles.previewContainer}>
            {selectedTemplate === "custom" &&
            isEditingCustom &&
            !showPreview ? (
              <TextInput
                style={styles.customTemplateInput}
                multiline
                value={customTemplate}
                onChangeText={setCustomTemplate}
                autoCorrect={false}
                placeholder="Enter your custom template with markdown formatting..."
                placeholderTextColor="#666"
              />
            ) : (
              <ScrollView contentContainerStyle={styles.previewScrollContainer}>
                <Markdown style={markdownStyles}>{previewContent}</Markdown>
              </ScrollView>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Tips:</Text>
            <Text style={styles.instructionsText}>
              • Templates use Markdown formatting{"\n"}• Customize your own
              template by selecting 'Custom'{"\n"}• Preview how your template
              will look before applying it
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalContent: {
    width: "90%",
    height: "85%",
    backgroundColor: "#121212",
    borderRadius: 12,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  applyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
  },
  applyButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "600",
  },
  templateSelectionContainer: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  templateOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#2A2A2A",
    borderRadius: 20,
    marginRight: 8,
  },
  selectedTemplateOption: {
    backgroundColor: "#FFFFFF",
  },
  templateOptionText: {
    color: "#CCC",
    fontSize: 14,
  },
  selectedTemplateOptionText: {
    color: "#000",
    fontWeight: "600",
  },
  customTemplateControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#2A2A2A",
    borderRadius: 6,
    marginRight: 8,
  },
  editButtonText: {
    color: "#FFF",
    fontSize: 14,
    marginLeft: 6,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
  },
  saveButtonText: {
    color: "#000",
    fontSize: 14,
    marginLeft: 6,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    margin: 16,
    borderRadius: 8,
  },
  previewScrollContainer: {
    padding: 16,
  },
  customTemplateInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlignVertical: "top",
    padding: 16,
  },
  instructionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  instructionsTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  instructionsText: {
    color: "#AAA",
    fontSize: 12,
    lineHeight: 18,
  },
});

export default JournalTemplateManager;
