// Patient Behavior Designer Module
// Converts form-based patient design into ElevenLabs workflow API format

let pivotCounter = 5; // Start at 5 since we have 5 default pivots (Marcus Johnson example)

// DOM Elements
const patientForm = document.getElementById('patient-designer-form');
const pivotsContainer = document.getElementById('pivots-container');
const addPivotBtn = document.getElementById('add-pivot-btn');
const resetDesignerBtn = document.getElementById('reset-designer-btn');
const previewBranches = document.getElementById('preview-branches');

// Voice elements
const patientVoiceSelect = document.getElementById('patient-voice');
const patientPreviewVoiceBtn = document.getElementById('patient-preview-voice-btn');
const patientBrowseVoicesBtn = document.getElementById('patient-browse-voices-btn');

// Initialize
export function initWorkflow() {
  setupEventListeners();
  updatePreview();
}

function setupEventListeners() {
  // Add pivot button
  addPivotBtn?.addEventListener('click', addPivot);
  
  // Reset button
  resetDesignerBtn?.addEventListener('click', resetForm);
  
  // Remove pivot buttons (delegated)
  pivotsContainer?.addEventListener('click', (e) => {
    if (e.target.classList.contains('pivot-remove')) {
      const card = e.target.closest('.pivot-card');
      if (card && pivotsContainer.querySelectorAll('.pivot-card').length > 1) {
        card.remove();
        updatePreview();
      } else {
        alert('You need at least one behavioral pivot.');
      }
    }
  });
  
  // Update preview when pivot titles change
  pivotsContainer?.addEventListener('input', (e) => {
    if (e.target.classList.contains('pivot-condition')) {
      updatePreview();
    }
  });
}

function addPivot() {
  pivotCounter++;
  const pivotId = `pivot-${pivotCounter}`;
  
  const pivotCard = document.createElement('div');
  pivotCard.className = 'pivot-card';
  pivotCard.dataset.pivotId = pivotId;
  
  pivotCard.innerHTML = `
    <div class="pivot-header">
      <span class="pivot-icon neutral">?</span>
      <span class="pivot-title">Custom Behavioral Pivot</span>
      <button type="button" class="pivot-remove" title="Remove pivot">&times;</button>
    </div>
    <div class="pivot-body">
      <div class="form-group">
        <label>Trigger Condition</label>
        <textarea class="pivot-condition" rows="2" placeholder="What student behavior triggers this response?"></textarea>
      </div>
      <div class="form-group">
        <label>Patient Response</label>
        <textarea class="pivot-response" rows="3" placeholder="How does the patient respond to this behavior?"></textarea>
      </div>
    </div>
  `;
  
  pivotsContainer.appendChild(pivotCard);
  updatePreview();
  
  // Focus the new condition field
  pivotCard.querySelector('.pivot-condition').focus();
}

function resetForm() {
  if (!confirm('Reset the form? This will reload the page with the example patient.')) return;
  
  // Reload page to restore default example
  window.location.reload();
}

function updatePreview() {
  if (!previewBranches) return;
  
  const pivots = pivotsContainer?.querySelectorAll('.pivot-card') || [];
  let html = '';
  
  pivots.forEach((pivot, index) => {
    const icon = pivot.querySelector('.pivot-icon');
    const title = pivot.querySelector('.pivot-title')?.textContent || `Pivot ${index + 1}`;
    
    let branchClass = 'preview-branch-neutral';
    if (icon?.classList.contains('good')) branchClass = 'preview-branch-good';
    if (icon?.classList.contains('bad')) branchClass = 'preview-branch-bad';
    
    // Shorten title for preview
    const shortTitle = title.length > 25 ? title.substring(0, 22) + '...' : title;
    
    html += `
      <div class="preview-branch ${branchClass}">
        <span class="preview-arrow">→</span>
        <div class="preview-node">${shortTitle}</div>
      </div>
    `;
  });
  
  previewBranches.innerHTML = html;
}

// Generate workflow data for API
export function getWorkflowData() {
  const patientName = document.getElementById('patient-name')?.value || 'Patient';
  const patientAge = document.getElementById('patient-age')?.value || '';
  const patientGender = document.getElementById('patient-gender')?.value || 'male';
  const presentingComplaint = document.getElementById('presenting-complaint')?.value || '';
  const hiddenDiagnosis = document.getElementById('hidden-diagnosis')?.value || '';
  const initialPresentation = document.getElementById('initial-presentation')?.value || '';
  const firstWords = document.getElementById('first-words')?.value || '';
  
  // Build base patient prompt
  const basePrompt = buildPatientPrompt({
    name: patientName,
    age: patientAge,
    gender: patientGender,
    complaint: presentingComplaint,
    diagnosis: hiddenDiagnosis
  });
  
  // Build workflow nodes and edges
  const nodes = {
    start_node: {
      type: 'start',
      position: { x: 0, y: 0 },
      edge_order: ['edge_start_to_initial']
    },
    initial_state: {
      type: 'override_agent',
      label: 'Initial Presentation',
      additional_prompt: `CURRENT STATE: Initial presentation. ${initialPresentation}

You are in your initial state. Present your symptoms as described but don't volunteer too much information yet. Wait to see how the medical student approaches you before deciding how open to be.`,
      position: { x: 200, y: 0 },
      edge_order: []
    }
  };
  
  const edges = {
    edge_start_to_initial: {
      source: 'start_node',
      target: 'initial_state',
      forward_condition: { type: 'unconditional' }
    }
  };
  
  // Add pivot nodes and edges
  const pivotCards = pivotsContainer?.querySelectorAll('.pivot-card') || [];
  
  pivotCards.forEach((card, index) => {
    const pivotId = card.dataset.pivotId || `pivot_${index}`;
    const nodeId = `state_${pivotId}`;
    const edgeId = `edge_initial_to_${pivotId}`;
    
    const condition = card.querySelector('.pivot-condition')?.value || '';
    const response = card.querySelector('.pivot-response')?.value || '';
    const title = card.querySelector('.pivot-title')?.textContent || `State ${index + 1}`;
    
    // Add node
    nodes[nodeId] = {
      type: 'override_agent',
      label: title,
      additional_prompt: `BEHAVIORAL STATE: ${title}

The medical student has triggered this response. Your behavior now:
${response}

Continue the conversation in this emotional state. If the student's approach changes significantly, you may shift to a different state.`,
      position: { x: 400, y: index * 100 },
      edge_order: []
    };
    
    // Add edge with LLM condition
    edges[edgeId] = {
      source: 'initial_state',
      target: nodeId,
      forward_condition: {
        type: 'llm',
        condition: condition
      }
    };
    
    // Add edge ID to initial state's edge order
    nodes.initial_state.edge_order.push(edgeId);
  });
  
  return {
    nodes,
    edges,
    basePrompt,
    firstMessage: firstWords
  };
}

function buildPatientPrompt({ name, age, gender, complaint, diagnosis }) {
  return `You are a standardized patient for medical education. You are role-playing as a patient in a clinical encounter with a medical student.

PATIENT IDENTITY:
- Name: ${name}
- Age: ${age || 'Not specified'}
- Gender: ${gender}

PRESENTING COMPLAINT: ${complaint}

${diagnosis ? `HIDDEN INFORMATION (reveal only if the student builds rapport and asks the right questions): ${diagnosis}` : ''}

IMPORTANT INSTRUCTIONS:
1. Stay in character as the patient at all times
2. Respond naturally and realistically to the student's questions
3. Your emotional state and willingness to share information should depend on how the student treats you
4. If the student is empathetic and professional, you can open up more
5. If the student is rushed, dismissive, or uses too much jargon, become more guarded
6. Never break character to explain what you're doing or why
7. React emotionally as a real patient would - show anxiety, frustration, relief, etc.
8. Don't volunteer all information at once - let the student discover things through good questioning`;
}

// Get form data for creating agent
export function getPatientFormData() {
  const workflowData = getWorkflowData();
  
  return {
    name: document.getElementById('patient-name')?.value || 'Adaptive Patient',
    prompt: workflowData.basePrompt,
    first_message: workflowData.firstMessage,
    voice_id: document.getElementById('patient-voice')?.value || '',
    workflow: {
      nodes: workflowData.nodes,
      edges: workflowData.edges
    }
  };
}

// Populate voice select
export function populateWorkflowVoices(voices) {
  if (!patientVoiceSelect) return;
  
  const options = voices.map(v => 
    `<option value="${v.voice_id}">${v.name}</option>`
  ).join('');
  
  patientVoiceSelect.innerHTML = '<option value="">Select a voice...</option>' + options;
}

// Export for voice preview/browse buttons
export function getVoiceElements() {
  return {
    select: patientVoiceSelect,
    previewBtn: patientPreviewVoiceBtn,
    browseBtn: patientBrowseVoicesBtn
  };
}

// Load existing patient data into the form (for editing)
export function loadPatientData(agent) {
  if (!agent) return;
  
  // Extract patient info from the prompt
  const prompt = agent.conversation_config?.agent?.prompt?.prompt || '';
  
  // Set name
  document.getElementById('patient-name').value = agent.name || '';
  
  // Try to extract age from prompt
  const ageMatch = prompt.match(/Age:\s*(\d+)/i);
  if (ageMatch) {
    document.getElementById('patient-age').value = ageMatch[1];
  }
  
  // Try to extract gender from prompt
  const genderMatch = prompt.match(/Gender:\s*(\w+)/i);
  if (genderMatch) {
    const gender = genderMatch[1].toLowerCase();
    document.getElementById('patient-gender').value = gender;
  }
  
  // Try to extract presenting complaint
  const complaintMatch = prompt.match(/PRESENTING COMPLAINT:\s*([^\n]+)/i);
  if (complaintMatch) {
    document.getElementById('presenting-complaint').value = complaintMatch[1].trim();
  }
  
  // Try to extract hidden diagnosis
  const hiddenMatch = prompt.match(/HIDDEN INFORMATION[^:]*:\s*([^\n]+)/i);
  if (hiddenMatch) {
    document.getElementById('hidden-diagnosis').value = hiddenMatch[1].trim();
  }
  
  // Set first words
  document.getElementById('first-words').value = agent.conversation_config?.agent?.first_message || '';
  
  // Set voice
  const voiceId = agent.conversation_config?.tts?.voice_id;
  if (voiceId && patientVoiceSelect) {
    patientVoiceSelect.value = voiceId;
  }
  
  // Load workflow pivots if present
  if (agent.workflow && agent.workflow.nodes) {
    loadWorkflowPivots(agent.workflow);
  }
  
  updatePreview();
}

function loadWorkflowPivots(workflow) {
  if (!workflow.nodes || !workflow.edges) return;
  
  // Find initial state node to get its behavior
  const initialNode = workflow.nodes['initial_state'];
  if (initialNode && initialNode.additional_prompt) {
    // Try to extract initial presentation from the prompt
    const presentation = initialNode.additional_prompt
      .replace(/CURRENT STATE:[^\n]*\n?/i, '')
      .replace(/You are in your initial state\.[^\n]*\n?/i, '')
      .trim();
    
    if (presentation) {
      document.getElementById('initial-presentation').value = presentation;
    }
  }
  
  // Clear existing pivots
  pivotsContainer.innerHTML = '';
  pivotCounter = 0;
  
  // Find all pivot nodes (not start_node or initial_state)
  const pivotNodes = Object.entries(workflow.nodes).filter(([id, node]) => 
    id !== 'start_node' && id !== 'initial_state' && node.type === 'override_agent'
  );
  
  // Find edges for each pivot to get conditions
  pivotNodes.forEach(([nodeId, node]) => {
    pivotCounter++;
    const pivotId = `pivot-${pivotCounter}`;
    
    // Find the edge that leads to this node
    const edge = Object.values(workflow.edges).find(e => e.target === nodeId);
    const condition = edge?.forward_condition?.condition || '';
    
    // Extract response from additional_prompt
    let response = node.additional_prompt || '';
    response = response
      .replace(/BEHAVIORAL STATE:[^\n]*\n?/i, '')
      .replace(/The medical student has triggered this response\.[^\n]*\n?/i, '')
      .replace(/Continue the conversation[^\n]*\n?/i, '')
      .replace(/Your behavior now:\s*/i, '')
      .trim();
    
    // Determine icon type based on label
    const label = node.label || `Pivot ${pivotCounter}`;
    let iconClass = 'neutral';
    let iconSymbol = '?';
    
    if (label.toLowerCase().includes('empathy') || 
        label.toLowerCase().includes('concern') || 
        label.toLowerCase().includes('interest') ||
        label.toLowerCase().includes('validates')) {
      iconClass = 'good';
      iconSymbol = '&#10004;';
    } else if (label.toLowerCase().includes('dismiss') || 
               label.toLowerCase().includes('cold') || 
               label.toLowerCase().includes('slow down') ||
               label.toLowerCase().includes('hostile')) {
      iconClass = 'bad';
      iconSymbol = '&#10008;';
    }
    
    const pivotCard = document.createElement('div');
    pivotCard.className = 'pivot-card';
    pivotCard.dataset.pivotId = pivotId;
    
    pivotCard.innerHTML = `
      <div class="pivot-header">
        <span class="pivot-icon ${iconClass}">${iconSymbol}</span>
        <span class="pivot-title">${escapeHtml(label)}</span>
        <button type="button" class="pivot-remove" title="Remove pivot">&times;</button>
      </div>
      <div class="pivot-body">
        <div class="form-group">
          <label>Trigger Condition</label>
          <textarea class="pivot-condition" rows="2">${escapeHtml(condition)}</textarea>
        </div>
        <div class="form-group">
          <label>Patient Response</label>
          <textarea class="pivot-response" rows="3">${escapeHtml(response)}</textarea>
        </div>
      </div>
    `;
    
    pivotsContainer.appendChild(pivotCard);
  });
  
  // If no pivots found, add default ones
  if (pivotCounter === 0) {
    addPivot();
    addPivot();
  }
}

// Set edit mode (changes button text and behavior)
let editingAgentId = null;

export function setEditMode(agentId) {
  editingAgentId = agentId;
  const submitBtn = document.getElementById('create-adaptive-patient-btn');
  if (submitBtn) {
    submitBtn.textContent = agentId ? 'Update Patient' : 'Create Adaptive Patient';
  }
}

export function getEditingAgentId() {
  return editingAgentId;
}

export function clearEditMode() {
  editingAgentId = null;
  const submitBtn = document.getElementById('create-adaptive-patient-btn');
  if (submitBtn) {
    submitBtn.textContent = 'Create Adaptive Patient';
  }
}

// Helper
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
initWorkflow();
