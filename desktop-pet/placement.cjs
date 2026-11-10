function readPlacement(value) {
  return value === 'left' || value === 'center' ? value : 'right';
}

function bottomPosition(area, size, placement) {
  const width = area.width-size;
  const margin = Math.min(12,width/2);
  const horizontal = {left:margin,center:width/2,right:width-margin};
  return [Math.round(area.x+horizontal[placement]),area.y+area.height-size-3];
}

module.exports = {readPlacement,bottomPosition};
