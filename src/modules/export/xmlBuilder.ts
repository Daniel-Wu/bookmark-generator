/**
 * XML builder utility for creating well-formed XML documents
 * Used for generating 3MF format files with proper namespace support
 */

import type { XMLBuilder as IXMLBuilder } from '../../types/export';

/**
 * XML element representation
 */
interface XMLElement {
  name: string;
  attributes: Record<string, string>;
  children: XMLElement[];
  content: string;
  closed: boolean;
}

/**
 * Efficient XML document builder with namespace support
 */
export class XMLBuilder implements IXMLBuilder {
  private elements: XMLElement[] = [];
  private elementStack: XMLElement[] = [];
  private indentSize = 2;
  private encoding = 'UTF-8';
  private version = '1.0';

  /**
   * Set XML declaration parameters
   */
  declaration(version = '1.0', encoding = 'UTF-8'): XMLBuilder {
    this.version = version;
    this.encoding = encoding;
    return this;
  }

  /**
   * Start a new XML element
   */
  element(name: string, attributes: Record<string, string> = {}, content = ''): XMLBuilder {
    const element: XMLElement = {
      name,
      attributes: { ...attributes },
      children: [],
      content,
      closed: false
    };

    if (this.elementStack.length === 0) {
      this.elements.push(element);
    } else {
      const parent = this.elementStack[this.elementStack.length - 1];
      parent.children.push(element);
    }

    this.elementStack.push(element);
    return this;
  }

  /**
   * Close the current element
   */
  closeElement(): XMLBuilder {
    if (this.elementStack.length === 0) {
      throw new Error('No element to close');
    }

    const element = this.elementStack.pop()!;
    element.closed = true;
    return this;
  }

  /**
   * Add content to the current element
   */
  content(text: string): XMLBuilder {
    if (this.elementStack.length === 0) {
      throw new Error('No element to add content to');
    }

    const element = this.elementStack[this.elementStack.length - 1];
    element.content += this.escapeXML(text);
    return this;
  }

  /**
   * Add CDATA section to current element
   */
  cdata(text: string): XMLBuilder {
    if (this.elementStack.length === 0) {
      throw new Error('No element to add CDATA to');
    }

    const element = this.elementStack[this.elementStack.length - 1];
    element.content += `<![CDATA[${text}]]>`;
    return this;
  }

  /**
   * Set attribute on current element
   */
  attribute(name: string, value: string): XMLBuilder {
    if (this.elementStack.length === 0) {
      throw new Error('No element to add attribute to');
    }

    const element = this.elementStack[this.elementStack.length - 1];
    element.attributes[name] = value;
    return this;
  }

  /**
   * Add multiple attributes to current element
   */
  attributes(attrs: Record<string, string>): XMLBuilder {
    if (this.elementStack.length === 0) {
      throw new Error('No element to add attributes to');
    }

    const element = this.elementStack[this.elementStack.length - 1];
    Object.assign(element.attributes, attrs);
    return this;
  }

  /**
   * Create self-closing element
   */
  selfClosingElement(name: string, attributes: Record<string, string> = {}): XMLBuilder {
    const element: XMLElement = {
      name,
      attributes: { ...attributes },
      children: [],
      content: '',
      closed: true
    };

    if (this.elementStack.length === 0) {
      this.elements.push(element);
    } else {
      const parent = this.elementStack[this.elementStack.length - 1];
      parent.children.push(element);
    }

    return this;
  }

  /**
   * Set indentation size
   */
  setIndentation(size: number): XMLBuilder {
    this.indentSize = Math.max(0, size);
    return this;
  }

  /**
   * Generate final XML string
   */
  toString(): string {
    // Close any unclosed elements
    while (this.elementStack.length > 0) {
      this.closeElement();
    }

    let xml = `<?xml version="${this.version}" encoding="${this.encoding}"?>\n`;
    
    for (const element of this.elements) {
      xml += this.renderElement(element, 0);
    }

    return xml;
  }

  /**
   * Get XML without declaration
   */
  toStringWithoutDeclaration(): string {
    // Close any unclosed elements
    while (this.elementStack.length > 0) {
      this.closeElement();
    }

    let xml = '';
    for (const element of this.elements) {
      xml += this.renderElement(element, 0);
    }

    return xml;
  }

  /**
   * Render an XML element to string
   */
  private renderElement(element: XMLElement, depth: number): string {
    const indent = ' '.repeat(depth * this.indentSize);
    const attributes = this.renderAttributes(element.attributes);
    
    if (element.children.length === 0 && element.content === '') {
      // Self-closing tag
      return `${indent}<${element.name}${attributes}/>\n`;
    }

    let xml = `${indent}<${element.name}${attributes}>`;

    if (element.content) {
      xml += element.content;
    }

    if (element.children.length > 0) {
      xml += '\n';
      for (const child of element.children) {
        xml += this.renderElement(child, depth + 1);
      }
      xml += indent;
    }

    xml += `</${element.name}>\n`;
    return xml;
  }

  /**
   * Render attributes to string
   */
  private renderAttributes(attributes: Record<string, string>): string {
    const attrPairs = Object.entries(attributes)
      .map(([key, value]) => `${key}="${this.escapeAttribute(value)}"`)
      .join(' ');
    
    return attrPairs ? ` ${attrPairs}` : '';
  }

  /**
   * Escape XML content
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape XML attribute values
   */
  private escapeAttribute(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Reset builder to initial state
   */
  reset(): XMLBuilder {
    this.elements = [];
    this.elementStack = [];
    return this;
  }

  /**
   * Create a new builder instance
   */
  static create(): XMLBuilder {
    return new XMLBuilder();
  }

  /**
   * Validate XML element name
   */
  private validateElementName(name: string): boolean {
    // XML name rules: starts with letter/underscore, contains letters/digits/hyphens/periods/underscores
    const nameRegex = /^[a-zA-Z_:][\w\-.:]*$/;
    return nameRegex.test(name);
  }

  /**
   * Create builder with namespace support
   */
  static createWithNamespace(namespace: string, prefix?: string): XMLBuilder {
    const builder = new XMLBuilder();
    const nsAttr = prefix ? `xmlns:${prefix}` : 'xmlns';
    return builder.element('root', { [nsAttr]: namespace });
  }
}

/**
 * Specialized builder for 3MF format XML files
 */
export class ThreeMFXMLBuilder extends XMLBuilder {
  /**
   * Create content types XML structure
   */
  static createContentTypes(): XMLBuilder {
    return new XMLBuilder()
      .declaration()
      .element('Types', {
        'xmlns': 'http://schemas.openxmlformats.org/package/2006/content-types'
      })
        .selfClosingElement('Default', {
          'Extension': 'rels',
          'ContentType': 'application/vnd.openxmlformats-package.relationships+xml'
        })
        .selfClosingElement('Default', {
          'Extension': 'model',
          'ContentType': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'
        })
        .selfClosingElement('Default', {
          'Extension': 'png',
          'ContentType': 'image/png'
        })
      .closeElement();
  }

  /**
   * Create relationships XML structure
   */
  static createRelationships(): XMLBuilder {
    return new XMLBuilder()
      .declaration()
      .element('Relationships', {
        'xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships'
      })
        .selfClosingElement('Relationship', {
          'Id': 'rel-1',
          'Type': 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel',
          'Target': '/3D/3dmodel.model'
        })
        .selfClosingElement('Relationship', {
          'Id': 'rel-2',
          'Type': 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail',
          'Target': '/Metadata/thumbnail.png'
        })
      .closeElement();
  }

  /**
   * Create model XML structure with proper 3MF namespaces
   */
  static createModel(): XMLBuilder {
    return new XMLBuilder()
      .declaration()
      .element('model', {
        'unit': 'millimeter',
        'xml:lang': 'en-US',
        'xmlns': 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02',
        'xmlns:m': 'http://schemas.microsoft.com/3dmanufacturing/material/2015/02'
      });
  }
}