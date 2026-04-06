/**
 * Layout Template System
 * 
 * Système de templating de mise en page
 * Crée et gère des templates de mise en page personnalisables
 */

import { LayoutCreator, LayoutTemplate } from "./layout-creator";

export interface LayoutTemplateVariable {
  name: string;
  type: "text" | "number" | "date" | "geometry" | "image";
  defaultValue: any;
  description: string;
  required: boolean;
}

export interface TemplateVariable {
  key: string;
  value: any;
}

export interface RenderedTemplate {
  templateId: string;
  variables: TemplateVariable[];
  renderedLayout: any;
  preview?: string;
}

/**
 * Gestionnaire de templates de mise en page
 */
export class LayoutTemplateManager {
  private templates: Map<string, LayoutTemplate>;
  private variables: Map<string, LayoutTemplateVariable[]>;
  
  constructor() {
    this.templates = new Map();
    this.variables = new Map();
    this.initializeTemplates();
  }
  
  /**
   * Crée un nouveau template personnalisé
   */
  createTemplate(
    template: Omit<LayoutTemplate, "id">,
    variables: LayoutTemplateVariable[]
  ): LayoutTemplate {
    console.log(`📄 Création de template: ${template.name}`);
    
    const newTemplate: LayoutTemplate = {
      ...template,
      id: `template_${Date.now()}`,
    };
    
    this.templates.set(newTemplate.id, newTemplate);
    this.variables.set(newTemplate.id, variables);
    
    console.log(`   ✅ Template créé: ${newTemplate.id}`);
    return newTemplate;
  }
  
  /**
   * Rend un template avec des variables
   */
  renderTemplate(
    templateId: string,
    variables: TemplateVariable[]
  ): RenderedTemplate {
    console.log(`🎨 Rendu de template: ${templateId}`);
    
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template non trouvé: ${templateId}`);
    }
    
    const templateVars = this.variables.get(templateId) || [];
    
    // Valider les variables requises
    const missingVars = templateVars
      .filter(v => v.required && !variables.find(tv => tv.key === v.name))
      .map(v => v.name);
    
    if (missingVars.length > 0) {
      throw new Error(`Variables manquantes: ${missingVars.join(", ")}`);
    }
    
    // Substituer les variables dans les éléments
    const renderedElements = this.substituteVariables(template.elements, variables);
    
    const rendered: RenderedTemplate = {
      templateId,
      variables,
      renderedLayout: {
        ...template,
        elements: renderedElements,
      },
    };
    
    console.log(`   ✅ Template rendu`);
    return rendered;
  }
  
  /**
   * Substitue les variables dans les éléments
   */
  private substituteVariables(elements: any[], variables: TemplateVariable[]): any[] {
    return elements.map(element => {
      const newElement = { ...element };
      
      // Substituer dans les propriétés
      for (const [key, value] of Object.entries(element.properties)) {
        if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
          const varName = value.slice(2, -2);
          const variable = variables.find(v => v.key === varName);
          if (variable) {
            newElement.properties[key] = variable.value;
          }
        }
      }
      
      return newElement;
    });
  }
  
  /**
   * Clone un template existant
   */
  cloneTemplate(templateId: string, newName: string): LayoutTemplate | null {
    console.log(`📋 Clonage de template: ${templateId}`);
    
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }
    
    const cloned: LayoutTemplate = {
      ...template,
      id: `template_${Date.now()}`,
      name: newName,
      description: `${template.description} (copie)`,
    };
    
    const vars = this.variables.get(templateId);
    if (vars) {
      this.variables.set(cloned.id, [...vars]);
    }
    
    this.templates.set(cloned.id, cloned);
    
    console.log(`   ✅ Template cloné: ${cloned.id}`);
    return cloned;
  }
  
  /**
   * Supprime un template
   */
  deleteTemplate(templateId: string): boolean {
    console.log(`🗑️  Suppression de template: ${templateId}`);
    
    const deleted = this.templates.delete(templateId);
    this.variables.delete(templateId);
    
    if (deleted) {
      console.log(`   ✅ Template supprimé`);
    }
    
    return deleted;
  }
  
  /**
   * Retourne tous les templates
   */
  getTemplates(): LayoutTemplate[] {
    return Array.from(this.templates.values());
  }
  
  /**
   * Retourne un template par ID
   */
  getTemplate(templateId: string): LayoutTemplate | undefined {
    return this.templates.get(templateId);
  }
  
  /**
   * Retourne les variables d'un template
   */
  getTemplateVariables(templateId: string): LayoutTemplateVariable[] {
    return this.variables.get(templateId) || [];
  }
  
  /**
   * Initialise les templates par défaut
   */
  private initializeTemplates(): void {
    // Template de carte forestière avec variables
    this.variables.set("forest_template", [
      {
        name: "forest_name",
        type: "text",
        defaultValue: "Forêt",
        description: "Nom de la forêt",
        required: true,
      },
      {
        name: "owner",
        type: "text",
        defaultValue: "ONF",
        description: "Propriétaire",
        required: false,
      },
      {
        name: "surface",
        type: "number",
        defaultValue: 0,
        description: "Surface en hectares",
        required: true,
      },
      {
        name: "date",
        type: "date",
        defaultValue: new Date().toISOString().split("T")[0],
        description: "Date du plan",
        required: false,
      },
    ]);
  }
  
  /**
   * Crée un template à partir d'une mise en page existante
   */
  createTemplateFromLayout(
    layoutName: string,
    templateName: string,
    description: string
  ): LayoutTemplate | null {
    console.log(`📄 Création de template depuis layout: ${layoutName}`);
    
    // À implémenter avec le bridge QGIS pour capturer la mise en page
    
    const template: LayoutTemplate = {
      id: `template_${Date.now()}`,
      name: templateName,
      description,
      pageSize: { size: "A4", width: 210, height: 297 },
      orientation: "portrait",
      margins: { top: 15, right: 15, bottom: 15, left: 15 },
      elements: [],
    };
    
    this.templates.set(template.id, template);
    this.variables.set(template.id, []);
    
    console.log(`   ✅ Template créé`);
    return template;
  }
  
  /**
   * Exporte un template
   */
  exportTemplate(templateId: string): string | null {
    const template = this.templates.get(templateId);
    if (!template) {
      return null;
    }
    
    const variables = this.variables.get(templateId) || [];
    
    const exportData = {
      template,
      variables,
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Importe un template
   */
  importTemplate(jsonData: string): LayoutTemplate | null {
    try {
      const data = JSON.parse(jsonData);
      const template = data.template as LayoutTemplate;
      const variables = data.variables as LayoutTemplateVariable[];
      
      // Générer un nouvel ID
      template.id = `template_${Date.now()}`;
      
      this.templates.set(template.id, template);
      this.variables.set(template.id, variables);
      
      console.log(`   ✅ Template importé`);
      return template;
    } catch (error) {
      console.log(`   ❌ Erreur d'import: ${error}`);
      return null;
    }
  }
  
  /**
   * Recherche des templates par nom
   */
  searchTemplates(query: string): LayoutTemplate[] {
    const lowerQuery = query.toLowerCase();
    
    return this.getTemplates().filter(template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * Met à jour un template
   */
  updateTemplate(templateId: string, updates: Partial<LayoutTemplate>): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }
    
    const updated = { ...template, ...updates };
    this.templates.set(templateId, updated);
    
    return true;
  }
}

/**
 * Helper pour créer un gestionnaire de templates
 */
export function createLayoutTemplateManager(): LayoutTemplateManager {
  return new LayoutTemplateManager();
}
