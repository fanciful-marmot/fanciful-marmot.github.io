var activities = {
  'Aerobic dancing class': 127,
  'Aerobic fitness class': 181,
  'Aerobics, low impact': 125,
  'Aerobics, step': 153,
  'Backpacking': 181,
  'Badminton, casual': 131,
  'Badminton, competitive': 203,
  'Ballet dancing': 120,
  'Baseball': 130,
  'Basketball, game': 145,
  'Basketball, recreational': 130,
  'Bicycling, easy pace': 130,
  'Bicycling, moderate pace': 170,
  'Bicycling, vigourous pace': 200,
  'Billiards/pool': 76,
  'Bowling': 71,
  'Boxing, non-competitive': 131,
  'Boxing, competitive': 222,
  'Calisthenics': 106,
  'Canoeing': 91,
  'Cheerleading': 100,
  'Children\'s playground game': 136,
  'Circuit training': 199,
  'Climbing, rock/mountain': 270,
  'Cooking': 61,
  'Croquet': 76,
  'Dancing, class': 109,
  'Dancing, salsa/country/swing': 109,
  'Dancing, party': 109,
  'Drill team': 153,
  'Electronic sports, Wii/PS3': 91,
  'Elliptical trainer': 203,
  'Fencing': 182,
  'Firewood carrying/chopping': 60,
  'Fishing': 91,
  'Football': 199,
  'Frisbee': 91,
  'Gardening': 80,
  'Gold, carrying clubs': 109,
  'Gold, powered cart': 80,
  'Grocery shopping': 67,
  'Gymnastics': 121,
  'Handball': 348,
  'Hiking': 172,
  'Hiking, orienteering': 232,
  'Hockey, field and ice': 240,
  'Home/auto repair': 91,
  'Horseback riding': 90,
  'Horseshoes': 71,
  'Housework, light': 72,
  'Ice skating, general': 84,
  'Ice skating, moderate': 122,
  'In-line skating': 190,
  'Jogging': 181,
  'Judo & Karate': 236,
  'Jumping rop, moderate': 250,
  'Jumping rope, fast': 300,
  'Kayaking': 152,
  'Kickball': 212,
  'Kickboxing': 290,
  'Lacrosse': 242,
  'Miniature golf': 91,
  'Mopping': 60,
  'Mowing lawn': 120,
  'Painting (a room)': 78,
  'Pilates': 91,
  'Punching bag': 180,
  'Raking lawn/leaves': 121,
  'Racquetball, casual': 181,
  'Racquetball, competitive': 254,
  // 'Rock climbing': 244, // Redundant?
  'Rollerblading': 156,
  'Rowing': 147,
  'Rowing machine': 212,
  'Rugby': 303,
  'Running, 12 min/mile, 7.5 min/km': 178,
  'Running, 10 min/mile, 6.2 min/km': 222,
  'Running, 8 min/mile, 5 min/km': 278,
  'Sailing, board and board': 91,
  'Scrubbing floors': 71,
  'Scuba diving': 203,
  'Shopping': 70,
  'Shoveling snow': 145,
  'Skateboarding': 102,
  'Skeeball': 52,
  'Skiing, light/moderate': 109,
  'Skiing, cross-country': 114,
  'Sledding': 158,
  'Snowboarding': 182,
  'Snowmobiling': 106,
  'Snowshoeing': 181,
  'Soccer, recreational': 145, // I think these were swapped?
  'Soccer, competitive': 181,
  'Softball': 152,
  'Spinning': 200,
  'Squash': 348,
  'Stair climbing, machine': 200,
  'Stair climbing, up starts': 181,
  'Stretching': 15,
  'Surfing': 91,
  'Swimming, backstroke': 181,
  'Swimming, butterfly': 272,
  'Swimming, freestyle': 181,
  'Swimming, leisure': 174,
  'Swimming, treading water': 116,
  'Table tennis': 120,
  'Tae Bo': 250,
  'Tae Kwon Do': 290,
  'Tai Chi': 40,
  'Tennis': 200,
  'Trampoline': 90,
  'Vacuuming': 94,
  'Volleyball': 91,
  'Walking, stroll': 61,
  'Walking, average': 84,
  'Washing a car': 71,
  'Water aerobics': 116,
  'Water polo': 303,
  'Water skiing': 145,
  'Waxing a car': 80,
  'Weight lifting': 67,
  'Wrestling': 145,
  'Yard work': 89,
  'Yoga': 45
};

// Gets the input value
var input = document.getElementById('stepInput');
function getMinutes() {
  return input.value || 0;
}

// Create the output display
var output = document.createElement('span');
function setOutput(n) {
  output.innerText = 'is ' + n + ' steps.'
}
setOutput(0);

// Create the drop down
var dropdown = document.createElement('select');
dropdown.name = 'activity';
Object.keys(activities)
  .forEach(activity => {
    var option = document.createElement('option');
    option.value = activities[activity];
    option.text = activity;
    dropdown.appendChild(option);
  });

// Listen for changes and update
function update() {
  setOutput(getMinutes() * dropdown.options[dropdown.selectedIndex].value);
}
dropdown.addEventListener('change', update);
input.addEventListener('change', update);
input.addEventListener('keyup', update);

// Append to the DOM
document.body.appendChild(dropdown);
document.body.appendChild(output);
