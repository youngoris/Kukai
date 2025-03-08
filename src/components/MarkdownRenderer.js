import React from 'react';
import { View, Text, Image, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';

// Process blockquote content
const processBlockquoteContent = (content) => {
  if (!content) return '';
  // Remove '>' symbol from blockquote
  return content.replace(/^>\s*/gm, '').trim();
};

// Markdown styles
const markdownStyles = {
  body: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'PingFang SC' : 'sans-serif',
  },
  // Title - Use heading1, heading2, etc. keys
  heading1: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    lineHeight: 36,
    marginVertical: 15,
    fontFamily: Platform.OS === 'ios' ? 'PingFang SC' : 'sans-serif',
  },
  heading2: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 12,
    lineHeight: 32,
    borderBottomWidth: 0.5,
    borderBottomColor: '#444',
    paddingBottom: 3,
  },
  heading3: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 10,
    lineHeight: 28,
  },
  heading4: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 8,
    lineHeight: 26,
  },
  heading5: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 6,
    lineHeight: 24,
  },
  heading6: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontStyle: 'italic',
    marginVertical: 4,
    lineHeight: 22,
  },
  // Other elements
  paragraph: {
    color: '#FFF',
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
    color: '#FFF', 
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ordered_list_item: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bullet_list_content: {
    flex: 1,
    color: '#FFF',
  },
  ordered_list_content: {
    flex: 1,
    color: '#FFF',
  },
  bullet_list_icon: {
    marginRight: 8,
    alignSelf: 'center',
  },
  ordered_list_icon: {
    marginRight: 8,
    alignSelf: 'center',
  },
  strong: {
    fontWeight: 'bold',
    color: '#FFF',
  },
  em: {
    fontStyle: 'italic',
    color: '#FFF',
  },
  link: {
    color: '#5E9EFF',
    textDecorationLine: 'underline',
  },
  code_inline: {
    backgroundColor: '#333',
    color: '#FFD700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    padding: 5,
    borderRadius: 3,
    fontSize: 14,
    borderColor:'#444',
  },
  code_block: {
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 3,
    color: '#FFD700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  fence: {
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 3,
    color: '#FFD700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#666',
    paddingLeft: 10,
    paddingVertical: 5,
    backgroundColor: '#222',
    borderRadius: 3,
    color: '#CCC',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  hr: {
    backgroundColor: '#444',
    height: 1,
    marginVertical: 15,
  },
  table: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 3,
    marginVertical: 10,
  },
  thead: {
    backgroundColor: '#222',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  th: {
    padding: 8,
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tbody: {
  },
  tr: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#333',
    flexDirection: 'row',
  },
  td: {
    padding: 8,
    color: '#FFF',
    fontSize: 14,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    marginVertical: 15,
    alignSelf: 'center',
  },
};

// Create custom rendering rules
const markdownRules = {
  heading1: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={[styles.heading1, { textAlign: 'left', letterSpacing: 0.5 }]}>
        {children}
      </Text>
    </View>
  ),
  heading2: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading2}>{children}</Text>
    </View>
  ),
  heading3: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading3}>{children}</Text>
    </View>
  ),
  heading4: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading4}>{children}</Text>
    </View>
  ),
  heading5: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading5}>{children}</Text>
    </View>
  ),
  heading6: (node, children, parent, styles) => (
    <View key={node.key} style={{ width: '100%' }}>
      <Text style={styles.heading6}>{children}</Text>
    </View>
  ),
  image: (node, children, parent, styles) => {
    // Extract attributes from node
    const { src, alt } = node.attributes || {};

    // Debug information
    console.log('Image node:', { src, alt });

    // Ensure image URL is valid
    if (!src) {
      console.log('Image source is empty');
      return null;
    }

    return (
      <View key={node.key} style={{width: '100%', marginVertical: 15}}>
        <View style={{
          width: '100%',
          // backgroundColor: '#1A1A1A',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <Image 
            source={{uri: src}} 
            style={{
              width: '100%',
              height: undefined,
              aspectRatio: 1,
              resizeMode: 'contain',
            }}
            accessible={true}
            accessibilityLabel={alt || 'Image'}
          />
        </View>
        {alt && <Text style={{color: '#999', fontSize: 12, marginTop: 5, textAlign: 'center'}}>{alt}</Text>}
      </View>
    );
  },
  fence: (node, children, parent, styles) => {
    return (
      <View key={node.key} style={[styles.fence, {marginVertical: 10, width: '100%'}]}>
        <Text style={{color: '#FFD700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'}}>
          {node.content}
        </Text>
      </View>
    );
  },
  blockquote: (node, children, parent, styles) => {
    // Ensure blockquote content is displayed correctly
    console.log('Blockquote node:', node);
    
    // Try to extract content from node
    let content = '';
    if (node.content) {
      content = processBlockquoteContent(node.content);
    } else if (node.children && node.children.length > 0) {
      // Try to extract content from child nodes
      content = node.children.map(child => {
        if (typeof child === 'string') return child;
        return child.content || '';
      }).join(' ');
      content = processBlockquoteContent(content);
    }
    
    return (
      <View key={node.key} style={styles.blockquote}>
        {children && children.length > 0 ? (
          children
        ) : content ? (
          <Text style={{color: '#CCC', fontStyle: 'italic'}}>
            {content}
          </Text>
        ) : (
          <Text style={{color: '#CCC', fontStyle: 'italic'}}>
            Quote content
          </Text>
        )}
      </View>
    );
  },
  code_block: (node, children, parent, styles) => {
    return (
      <View key={node.key} style={[styles.code_block, {marginVertical: 10, width: '100%'}]}>
        <Text style={{color: '#FFD700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'}}>
          {node.content}
        </Text>
      </View>
    );
  },
  bullet_list_item: (node, children, parent, styles) => {
    return (
      <View key={node.key} style={styles.bullet_list_item}>
        <View style={styles.bullet_list_icon}>
          <Text style={{color: '#FFF', fontSize: 16}}>•</Text>
        </View>
        <View style={styles.bullet_list_content}>
          {children}
        </View>
      </View>
    );
  },
  ordered_list_item: (node, children, parent, styles, inheritedProps) => {
    const number = inheritedProps?.index || 1;
    return (
      <View key={node.key} style={styles.ordered_list_item}>
        <View style={styles.ordered_list_icon}>
          <Text style={{color: '#FFF', fontSize: 16}}>{number}.</Text>
        </View>
        <View style={styles.ordered_list_content}>
          {children}
        </View>
      </View>
    );
  },
};

const MarkdownRenderer = ({ content }) => {
  return (
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
      allowedImageHandlers={['data:image/png;base64', 'data:image/gif;base64', 'data:image/jpeg;base64', 'https://', 'http://']}
      defaultImageHandler={'https://'}
    >
      {content}
    </Markdown>
  );
};

export default MarkdownRenderer; 