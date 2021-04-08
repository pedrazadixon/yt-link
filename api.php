<?php

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

if (!isset($_GET['q']))
    exit(json_encode(['error' => 'no url']));

$q = urldecode($_GET['q']);

if (preg_match('/^https?:\/\//', $q)) {
    $cmd = 'youtube-dl -f bestaudio --geo-bypass --get-url "' . $q . '" ';
} else {
    $cmd = 'youtube-dl -f bestaudio --geo-bypass --get-url "ytsearch1:' . $q . ' music" ';
}

$shell = trim(shell_exec($cmd));

if (empty($shell))
    exit(json_encode(['error' => 'can\'t get audio from url']));

exit(json_encode(['success' => $shell]));
