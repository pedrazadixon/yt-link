<?php

// var_dump(filter_var('https://youtu.be/lnAb9dnQCFE', FILTER_VALIDATE_URL));
// exit();

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

if (!isset($_GET['url']))
    exit(json_encode(['error' => 'no url']));

$cmd = 'youtube-dl -f best --geo-bypass --get-url "' . urldecode($_GET['url']) . '" ';

// $cmd = 'youtube-dl -f best --geo-bypass --get-url "ytsearch1:' . $_GET['url'] . '" ';

$shell = trim(shell_exec($cmd));

if (empty($shell))
    exit(json_encode(['error' => 'can\'t get audio from url']));

exit(json_encode(['success' => $shell]));
