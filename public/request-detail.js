// Old task files contain summaries, not the original provider request.
export function inputDetails(task) {
  if (task.requestRecord?.body) return {
    data: task.requestRecord.body,
    description: 'Input is the JSON request body submitted to the API. Authentication headers are excluded.',
    recorded: true
  };
  return {
    data: {
      prompt: task.meta?.prompt || task.batch?.prompt || null,
      saved_settings: task.options || {},
      saved_assets: (task.batch?.assets || []).map(asset => ({
        name: asset.name, type: asset.type, preview_url: asset.previewUrl || null
      }))
    },
    description: 'Original request unavailable for this older record. This is a saved input summary, not the original API request body.',
    recorded: false
  };
}

export function outputDetails(task) {
  return {
    task_id: task.providerTaskId || null,
    status: task.status,
    credits_consumed: task.consumedCredits ?? null,
    execution_time_ms: task.executionTimeMs ?? null,
    error: task.status === 'succeeded' ? null : task.error || null,
    outputs: (task.outputs || []).map(output => ({
      type: output.kind,
      url: output.sourceUrl || output.url || null,
      local_url: output.localUrl || null,
      file_name: output.localUrl?.split('/').at(-1) || null,
      file_size_bytes: output.bytes ?? null,
      ...(Number.isFinite(output.width) ? {width: output.width} : {}),
      ...(Number.isFinite(output.height) ? {height: output.height} : {}),
      ...(output.items ? {data: output.items} : {})
    }))
  };
}

export function specificationDetails(task, output, model) {
  const options = task.options || {};
  const headline = [];
  const represented = new Set(['contentProfile']);
  for (const key of ['duration', 'resolution', 'imageSize', 'size']) {
    const value = options[key];
    if (value === undefined || value === null || value === '') continue;
    if (key === 'duration') { headline.push(`${value}s`); represented.add(key); }
    if (key === 'resolution') { headline.push(String(value)); represented.add(key); }
    if (['imageSize', 'size'].includes(key)) { headline.push(`Size ${value}`); represented.add(key); }
  }
  if (options.width > 0 && options.height > 0) {
    headline.push(`${options.width}×${options.height}`);
    represented.add('width'); represented.add('height');
  }
  if (Number.isFinite(output?.bytes)) {
    const size = output.bytes;
    headline.push(size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB`);
  }
  for (const key of ['aspectRatio', 'ratio']) {
    if (options[key] !== undefined && options[key] !== null && options[key] !== '') { headline.push(String(options[key])); represented.add(key); }
  }
  const rows = Object.entries(options).filter(([key, value]) => !represented.has(key) && value !== undefined && value !== null && value !== '').map(([key, value]) => ({
    label: model?.options?.find(option => option.id === key)?.label || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()),
    value: typeof value === 'boolean' ? value ? 'On' : 'Off' : String(value)
  }));
  return {headline: headline.join(' · '), rows};
}
